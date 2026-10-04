import Anime from '#models/anime'
import Episode from '#models/episode'
import Season from '#models/season'
import User from '#models/user'
import {
  FileService,
  MetadataConflictError,
  MetadataNotFoundError,
} from '#services/file_service'
import { PlaybackSessionService } from '#services/playback_session_service'
import { getActiveTranscodeCount } from '#services/transcode_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { execa } from 'execa'

/** ffmpeg's version never changes while the server runs. */
let ffmpegVersion: string | null | undefined

async function detectFfmpeg(): Promise<string | null> {
  if (ffmpegVersion !== undefined) return ffmpegVersion
  try {
    const { stdout } = await execa('ffmpeg', ['-version'])
    ffmpegVersion = /ffmpeg version (\S+)/.exec(stdout)?.[1] ?? 'unknown'
  } catch {
    ffmpegVersion = null
  }
  return ffmpegVersion
}

/**
 * Server administration: dashboard figures, library scans and
 * metadata fixes. Every route here sits behind the `admin` middleware.
 */
@inject()
export default class AdminController {
  constructor(
    private fileService: FileService,
    private playbackSessions: PlaybackSessionService
  ) {}

  /** Library totals, scanner state and who is watching right now. */
  async dashboard({}: HttpContext) {
    const count = async (query: any) => Number((await query.count('* as total').first())?.$extras.total ?? 0)

    const totals = await Episode.query()
      .sum('size as total_size')
      .sum('duration as total_duration')
      .first()

    const sessions = this.playbackSessions.active()
    const episodes = sessions.length
      ? await Episode.query()
          .whereIn('id', sessions.map((s) => s.episodeId))
          .preload('season', (season) => season.preload('anime'))
      : []

    return {
      library: {
        animes: await count(Anime.query()),
        seasons: await count(Season.query()),
        episodes: await count(Episode.query()),
        users: await count(User.query()),
        totalSize: Number(totals?.$extras.total_size ?? 0),
        totalDuration: Number(totals?.$extras.total_duration ?? 0),
      },
      scan: this.fileService.scanStatus(),
      ffmpeg: await detectFfmpeg(),
      activeTranscodes: getActiveTranscodeCount(),
      sessions: sessions.map((session) => {
        const episode = episodes.find((e) => e.id === session.episodeId)
        return {
          userName: session.userName,
          episodeId: session.episodeId,
          episodeTitle: episode?.title ?? episode?.name ?? null,
          episodeNumber: episode?.episodeNumber ?? null,
          animeName: episode?.season?.anime?.name ?? null,
          position: session.position,
          duration: session.duration,
          method: session.method,
          paused: session.paused,
        }
      }),
    }
  }

  /** Kick off a library scan; returns immediately. */
  async scan({ response }: HttpContext) {
    void this.fileService.sync()
    return response.accepted(this.fileService.scanStatus())
  }

  /**
   * Refresh an anime's metadata. A `malId` in the body forces the match
   * to that MyAnimeList entry, fixing a wrong automatic identification.
   */
  async refreshMetadata({ params, request, response }: HttpContext) {
    const raw = request.input('malId')
    const malId = raw === undefined || raw === null || raw === '' ? undefined : Number(raw)
    if (malId !== undefined && (!Number.isInteger(malId) || malId <= 0)) {
      return response.badRequest({ error: 'malId must be a positive integer.' })
    }

    try {
      const anime = await this.fileService.refreshMetadata(Number(params.id), malId)
      return anime.serialize()
    } catch (e) {
      if (e instanceof MetadataNotFoundError) return response.notFound({ error: e.message })
      if (e instanceof MetadataConflictError) return response.conflict({ error: e.message })
      throw e
    }
  }
}
