import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'

/**
 * ffprobe wrapper describing what is inside a video file: container,
 * codecs, audio tracks, embedded subtitles and chapters.
 *
 * The result drives the playback decision (direct play / remux /
 * transcode) and feeds the audio & subtitle pickers of the player.
 * Probes are cached in memory, keyed by path + size + mtime, so a
 * replaced file is re-analysed automatically.
 */

export interface VideoStreamInfo {
  codec: string
  profile: string | null
  width: number
  height: number
  pixelFormat: string | null
  frameRate: number | null
}

export interface AudioTrackInfo {
  /** Position among the audio streams (ffmpeg's `0:a:<index>`). */
  index: number
  codec: string
  channels: number
  language: string | null
  title: string | null
  default: boolean
}

export interface EmbeddedSubtitleInfo {
  /** Position among the subtitle streams (ffmpeg's `0:s:<index>`). */
  index: number
  codec: string
  language: string | null
  title: string | null
  default: boolean
  forced: boolean
  /** False for bitmap formats (PGS, VobSub) that can't be sent as text. */
  textBased: boolean
}

export interface ChapterInfo {
  start: number
  end: number
  title: string | null
}

export interface MediaInfo {
  duration: number | null
  container: string
  bitRate: number | null
  video: VideoStreamInfo | null
  audio: AudioTrackInfo[]
  subtitles: EmbeddedSubtitleInfo[]
  chapters: ChapterInfo[]
}

export type PlaybackMethod = 'direct' | 'remux' | 'transcode'

const BROWSER_CONTAINERS = ['mp4', 'm4v', 'webm']
const BROWSER_VIDEO_CODECS = ['h264', 'vp8', 'vp9', 'av1']
const BROWSER_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac']
const TEXT_SUBTITLE_CODECS = ['ass', 'ssa', 'subrip', 'srt', 'webvtt', 'mov_text', 'text']
/** 8-bit 4:2:0 is the only H.264 flavour every browser decodes. */
const BROWSER_PIXEL_FORMATS = ['yuv420p', 'yuvj420p']

const cache = new Map<string, { key: string; info: MediaInfo }>()

function parseFrameRate(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const [num, den] = raw.split('/').map(Number)
  if (!num || !den) return null
  return Math.round((num / den) * 1000) / 1000
}

function toNumber(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export class MediaInfoService {
  /** Analyse a file. Returns null when ffprobe is missing or fails. */
  async probe(filePath: string): Promise<MediaInfo | null> {
    let cacheKey: string
    try {
      const stat = await fs.stat(filePath)
      cacheKey = `${stat.size}:${stat.mtimeMs}`
    } catch {
      return null
    }

    const cached = cache.get(filePath)
    if (cached && cached.key === cacheKey) return cached.info

    try {
      const { stdout } = await execa('ffprobe', [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        filePath,
      ])
      const info = this.parse(JSON.parse(stdout), filePath)
      cache.set(filePath, { key: cacheKey, info })
      return info
    } catch (e: any) {
      console.error(`[MediaInfo] ffprobe failed on "${filePath}":`, e.shortMessage ?? e.message)
      return null
    }
  }

  private parse(raw: any, filePath: string): MediaInfo {
    const streams: any[] = raw.streams ?? []
    // Cover art is exposed as a video stream flagged `attached_pic`.
    const videoStream = streams.find(
      (s) => s.codec_type === 'video' && !s.disposition?.attached_pic
    )
    const audioStreams = streams.filter((s) => s.codec_type === 'audio')
    const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle')

    const language = (s: any): string | null => {
      const lang = s.tags?.language
      return lang && lang !== 'und' ? String(lang) : null
    }

    return {
      duration: toNumber(raw.format?.duration) ?? toNumber(videoStream?.duration),
      container: path.extname(filePath).slice(1).toLowerCase(),
      bitRate: toNumber(raw.format?.bit_rate),
      video: videoStream
        ? {
            codec: String(videoStream.codec_name ?? 'unknown'),
            profile: videoStream.profile ?? null,
            width: Number(videoStream.width) || 0,
            height: Number(videoStream.height) || 0,
            pixelFormat: videoStream.pix_fmt ?? null,
            frameRate: parseFrameRate(videoStream.avg_frame_rate),
          }
        : null,
      audio: audioStreams.map((s, index) => ({
        index,
        codec: String(s.codec_name ?? 'unknown'),
        channels: Number(s.channels) || 2,
        language: language(s),
        title: s.tags?.title ?? null,
        default: Boolean(s.disposition?.default),
      })),
      subtitles: subtitleStreams.map((s, index) => ({
        index,
        codec: String(s.codec_name ?? 'unknown'),
        language: language(s),
        title: s.tags?.title ?? null,
        default: Boolean(s.disposition?.default),
        forced: Boolean(s.disposition?.forced),
        textBased: TEXT_SUBTITLE_CODECS.includes(String(s.codec_name)),
      })),
      chapters: (raw.chapters ?? []).map((c: any) => ({
        start: Number(c.start_time) || 0,
        end: Number(c.end_time) || 0,
        title: c.tags?.title ?? null,
      })),
    }
  }

  /** Whether the video stream can be sent to a browser without re-encoding. */
  canCopyVideo(info: MediaInfo): boolean {
    if (!info.video) return false
    if (!BROWSER_VIDEO_CODECS.includes(info.video.codec)) return false
    // fMP4 output: only H.264 is safe to stream-copy across browsers.
    if (info.video.codec !== 'h264') return false
    return !info.video.pixelFormat || BROWSER_PIXEL_FORMATS.includes(info.video.pixelFormat)
  }

  /**
   * Cheapest way to play a file in a browser with its default audio:
   *   - `direct`: the file is served untouched (range requests);
   *   - `remux`: video is copied, audio/container are converted;
   *   - `transcode`: video has to be re-encoded.
   */
  playbackMethod(info: MediaInfo): PlaybackMethod {
    const video = info.video
    if (!video) return 'transcode'

    const videoOk =
      BROWSER_VIDEO_CODECS.includes(video.codec) &&
      (!video.pixelFormat || BROWSER_PIXEL_FORMATS.includes(video.pixelFormat))
    const audioOk = info.audio.length === 0 || BROWSER_AUDIO_CODECS.includes(info.audio[0].codec)

    if (videoOk && audioOk && BROWSER_CONTAINERS.includes(info.container)) return 'direct'
    return this.canCopyVideo(info) ? 'remux' : 'transcode'
  }

  /**
   * Timestamp of the keyframe at or before `seconds`. A stream-copied
   * video can only start on a keyframe, so the player needs the real
   * start time to keep its clock and subtitles aligned.
   */
  async keyframeBefore(filePath: string, seconds: number): Promise<number> {
    if (seconds <= 0) return 0
    try {
      const { stdout } = await execa('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-skip_frame', 'nokey',
        '-show_entries', 'frame=pts_time',
        '-read_intervals', `${seconds}%+#1`,
        '-of', 'csv=p=0',
        filePath,
      ])
      const value = Number(stdout.split(/\r?\n/)[0]?.split(',')[0])
      return Number.isFinite(value) && value >= 0 && value <= seconds + 1 ? value : seconds
    } catch {
      return seconds
    }
  }
}
