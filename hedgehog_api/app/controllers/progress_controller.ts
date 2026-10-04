import Episode from '#models/episode'
import Season from '#models/season'
import UserAnimeFavorite from '#models/user_anime_favorite'
import UserEpisodeProgress from '#models/user_episode_progress'
import Anime from '#models/anime'
import { PlaybackSessionService } from '#services/playback_session_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/** Past this share of the runtime an episode counts as watched. */
const WATCHED_THRESHOLD = 0.9
/** Positions this close to the start aren't worth resuming. */
const MIN_RESUME_SECONDS = 5

/**
 * Per-user watch state: resume positions, watched flags and favorites.
 * Everything a client needs to build "Continue watching" / "Next up"
 * comes from `GET /progress` combined with the library listing.
 */
@inject()
export default class ProgressController {
  constructor(private playbackSessions: PlaybackSessionService) {}

  /** Every progress row of the signed-in user. */
  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const rows = await UserEpisodeProgress.query().where('user_id', user.id)
    return rows.map((row) => this.serialize(row))
  }

  /**
   * Periodic report sent by the player. Stores the resume position and
   * flips the episode to watched near the end.
   */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const episode = await Episode.findOrFail(params.id)

    const body = request.only(['position', 'duration', 'method', 'paused'])
    const position = Number(body.position)
    if (!Number.isFinite(position) || position < 0) {
      return response.badRequest({ error: 'position must be a positive number.' })
    }

    const reported = Number(body.duration)
    const duration = episode.duration ?? (Number.isFinite(reported) && reported > 0 ? reported : null)

    const row = await UserEpisodeProgress.firstOrNew({ userId: user.id, episodeId: episode.id })
    const reachedEnd = duration !== null && position >= duration * WATCHED_THRESHOLD

    if (reachedEnd) {
      // Finished: next time the episode starts from the beginning.
      row.viewed = true
      row.timestamp = 0
    } else {
      row.viewed = row.viewed ?? false
      row.timestamp = position < MIN_RESUME_SECONDS ? 0 : position
    }
    await row.save()

    this.playbackSessions.report({
      userId: user.id,
      userName: user.pseudo ?? user.email,
      episodeId: episode.id,
      position,
      duration,
      method: typeof body.method === 'string' ? body.method : 'direct',
      paused: Boolean(body.paused),
    })

    return this.serialize(row)
  }

  /** The player was closed: drop the user from the active sessions. */
  async stop({ auth, response }: HttpContext) {
    this.playbackSessions.end(auth.getUserOrFail().id)
    return response.noContent()
  }

  /** Mark one episode as watched / unwatched. */
  async watchedEpisode({ auth, params, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const episode = await Episode.findOrFail(params.id)
    await this.setWatched(user.id, [episode.id], this.flag(request))
    return this.rowsFor(user.id, [episode.id])
  }

  /** Mark a whole season as watched / unwatched. */
  async watchedSeason({ auth, params, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const season = await Season.findOrFail(params.id)
    const ids = (await Episode.query().where('season_id', season.id).select('id')).map((e) => e.id)
    await this.setWatched(user.id, ids, this.flag(request))
    return this.rowsFor(user.id, ids)
  }

  /** Mark a whole anime as watched / unwatched. */
  async watchedAnime({ auth, params, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const anime = await Anime.findOrFail(params.id)
    const seasonIds = (await Season.query().where('anime_id', anime.id).select('id')).map(
      (s) => s.id
    )
    const ids = seasonIds.length
      ? (await Episode.query().whereIn('season_id', seasonIds).select('id')).map((e) => e.id)
      : []
    await this.setWatched(user.id, ids, this.flag(request))
    return this.rowsFor(user.id, ids)
  }

  /** Ids of the animes the user starred. */
  async favorites({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const rows = await UserAnimeFavorite.query().where('user_id', user.id).select('anime_id')
    return rows.map((row) => row.animeId)
  }

  /** Star / unstar an anime. */
  async favorite({ auth, params, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const anime = await Anime.findOrFail(params.id)
    const favorite = request.input('favorite', true) !== false

    if (favorite) {
      await UserAnimeFavorite.firstOrCreate({ userId: user.id, animeId: anime.id })
    } else {
      await UserAnimeFavorite.query()
        .where('user_id', user.id)
        .where('anime_id', anime.id)
        .delete()
    }
    return { animeId: anime.id, favorite }
  }

  private flag(request: HttpContext['request']): boolean {
    return request.input('watched', true) !== false
  }

  private async setWatched(userId: number, episodeIds: number[], watched: boolean) {
    for (const episodeId of episodeIds) {
      await UserEpisodeProgress.updateOrCreate(
        { userId, episodeId },
        { viewed: watched, timestamp: 0 }
      )
    }
  }

  private async rowsFor(userId: number, episodeIds: number[]) {
    if (episodeIds.length === 0) return []
    const rows = await UserEpisodeProgress.query()
      .where('user_id', userId)
      .whereIn('episode_id', episodeIds)
    return rows.map((row) => this.serialize(row))
  }

  private serialize(row: UserEpisodeProgress) {
    return {
      episodeId: row.episodeId,
      position: row.timestamp ?? 0,
      watched: Boolean(row.viewed),
      updatedAt: row.updatedAt?.toISO() ?? null,
    }
  }
}
