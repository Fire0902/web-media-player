import Episode from '#models/episode'
import { FileService } from '#services/file_service'
import { MediaInfoService } from '#services/media_info_service'
import { resolveEpisodePath, userFromQueryToken } from '#services/media_access'
import {
  QUALITY_HEIGHTS,
  TranscodeService,
  type TranscodeQuality,
} from '#services/transcode_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import fs from 'fs'
import path from 'path'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
}

@inject()
export default class FilesController {
  constructor(
    private fileService: FileService,
    private transcodeService: TranscodeService,
    private mediaInfoService: MediaInfoService
  ) {}

  /** List the entire library (used by the SPA's Home view). */
  async index({ response }: HttpContext) {
    const medias = await this.fileService.index()
    return response.status(200).json(medias)
  }

  /**
   * Technical details of an episode's file plus the playback method the
   * player should use: direct play, remux or transcode.
   */
  async media({ params, response }: HttpContext) {
    const episode = await Episode.findOrFail(params.id)
    const filePath = resolveEpisodePath(episode)
    if (!filePath) return response.forbidden()

    const info = await this.mediaInfoService.probe(filePath)
    if (!info) {
      // No ffprobe: assume the file is playable and let the browser try.
      return response.ok({
        method: 'direct',
        canCopyVideo: false,
        size: episode.size,
        duration: episode.duration,
        container: path.extname(filePath).slice(1).toLowerCase(),
        bitRate: null,
        video: null,
        audio: [],
        subtitles: [],
        chapters: [],
      })
    }

    return response.ok({
      ...info,
      size: episode.size,
      method: this.mediaInfoService.playbackMethod(info),
      canCopyVideo: this.mediaInfoService.canCopyVideo(info),
    })
  }

  /**
   * Where a stream-copied video would really start for a given seek
   * target (the previous keyframe).
   */
  async keyframe({ params, request, response }: HttpContext) {
    const episode = await Episode.findOrFail(params.id)
    const filePath = resolveEpisodePath(episode)
    if (!filePath) return response.forbidden()

    const target = this.parseSeconds(request.qs().t)
    const time = await this.mediaInfoService.keyframeBefore(filePath, target)
    return response.ok({ time })
  }

  /**
   * Stream an episode.
   *
   * Two modes:
   *   - **direct**: HTTP range requests proxy the original file as-is.
   *     Default behaviour when no conversion is asked.
   *   - **converted**: with `?quality=`, `?audio=` or `?convert=1` the
   *     source goes through ffmpeg (remux when the video stream can be
   *     copied, transcode otherwise). Range requests are not supported —
   *     the client asks for a fresh stream when seeking, passing
   *     `?start=` to restart ffmpeg at that offset.
   */
  async stream({ request, response, params }: HttpContext) {
    const user = await userFromQueryToken(request)
    if (!user) return response.unauthorized('Invalid or missing token')

    const episode = await Episode.findOrFail(params.id)
    const filePath = resolveEpisodePath(episode)
    if (!filePath) return response.forbidden()
    if (!fs.existsSync(filePath)) return response.notFound('File is no longer on disk')

    const qs = request.qs()
    const quality = this.parseQuality(qs.quality)
    const audioIndex = this.parseIndex(qs.audio)
    const convert = qs.convert === '1' || quality !== null || audioIndex !== null

    if (!convert) {
      return this.streamDirect(request, response, filePath)
    }

    const info = await this.mediaInfoService.probe(filePath)
    return this.streamConverted(response, {
      inputPath: filePath,
      quality,
      copyVideo: info ? this.mediaInfoService.canCopyVideo(info) : false,
      audioIndex: audioIndex ?? 0,
      startSeconds: this.parseSeconds(qs.start),
    })
  }

  /** Direct byte-range streaming of the original file. */
  private streamDirect(
    request: HttpContext['request'],
    response: HttpContext['response'],
    filePath: string
  ) {
    const fileSize = fs.statSync(filePath).size
    const range = request.header('range')

    response.header('Accept-Ranges', 'bytes')
    response.header(
      'Content-Type',
      MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    )

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
      let start = match && match[1] ? Number.parseInt(match[1], 10) : Number.NaN
      let end = match && match[2] ? Number.parseInt(match[2], 10) : fileSize - 1

      // `bytes=-N`: the last N bytes of the file.
      if (match && !match[1] && match[2]) {
        start = Math.max(0, fileSize - Number.parseInt(match[2], 10))
        end = fileSize - 1
      }
      end = Math.min(end, fileSize - 1)

      if (!match || Number.isNaN(start) || start > end || start >= fileSize) {
        response.header('Content-Range', `bytes */${fileSize}`)
        return response.status(416).send('')
      }

      response.status(206)
      response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      response.header('Content-Length', String(end - start + 1))

      return response.stream(fs.createReadStream(filePath, { start, end }))
    }

    response.header('Content-Length', String(fileSize))
    return response.stream(fs.createReadStream(filePath))
  }

  /** ffmpeg-powered remux / re-encoding pipeline. */
  private streamConverted(
    response: HttpContext['response'],
    options: Parameters<TranscodeService['start']>[0]
  ) {
    const handle = this.transcodeService.start(options)

    response.header('Content-Type', 'video/mp4')
    // Converted streams are generated sequentially: no random access.
    response.header('Accept-Ranges', 'none')
    response.header('Cache-Control', 'no-store')

    // Make sure ffmpeg is killed if the client navigates away mid-stream.
    response.response.on('close', () => handle.abort())
    return response.stream(handle.stream)
  }

  /** Validate the `?quality=` query string against the supported presets. */
  private parseQuality(raw: unknown): TranscodeQuality | null {
    if (typeof raw !== 'string' || raw === 'source') return null
    return raw in QUALITY_HEIGHTS ? (raw as TranscodeQuality) : null
  }

  /** Parse a non-negative offset in seconds. */
  private parseSeconds(raw: unknown): number {
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  /** Parse a small non-negative stream index, or null when absent. */
  private parseIndex(raw: unknown): number | null {
    if (typeof raw !== 'string' || raw === '') return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 && n < 64 ? n : null
  }
}
