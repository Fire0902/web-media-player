import Episode from '#models/episode'
import { MediaInfoService } from '#services/media_info_service'
import { resolveEpisodePath, userFromQueryToken } from '#services/media_access'
import { SubtitleService } from '#services/subtitle_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Subtitle endpoints.
 *
 * - `GET /episodes/:id/subtitles` (token-authenticated): lists every
 *   subtitle available for the episode — sidecar files next to the
 *   video and text tracks embedded in the container.
 * - `GET /episodes/:id/subtitles/:trackId` (query-token authenticated):
 *   streams the actual subtitle payload. The token is passed via query
 *   string so `<track src>` and JASSUB's `subUrl` can reach the endpoint
 *   without a custom fetcher.
 */
@inject()
export default class SubtitlesController {
  constructor(
    private subtitleService: SubtitleService,
    private mediaInfoService: MediaInfoService
  ) {}

  /** List the available subtitle tracks for an episode. */
  async index({ params, response }: HttpContext) {
    const episode = await Episode.findOrFail(params.id)
    const videoPath = resolveEpisodePath(episode)
    if (!videoPath) return response.forbidden()

    const info = await this.mediaInfoService.probe(videoPath)
    const tracks = await this.subtitleService.listForVideo(videoPath, info)
    return response.ok(
      tracks.map((track) => ({
        id: track.id,
        label: track.label,
        format: track.format,
        source: track.source,
      }))
    )
  }

  /** Stream a single subtitle track (converted to VTT when appropriate). */
  async show({ params, request, response }: HttpContext) {
    const user = await userFromQueryToken(request)
    if (!user) return response.unauthorized('Invalid or missing token')

    const episode = await Episode.findOrFail(params.id)
    const videoPath = resolveEpisodePath(episode)
    if (!videoPath) return response.forbidden()

    const info = await this.mediaInfoService.probe(videoPath)
    const tracks = await this.subtitleService.listForVideo(videoPath, info)
    const track = this.subtitleService.findTrack(tracks, params.trackId)
    if (!track) return response.notFound('Subtitle not found')

    const offset = Number(request.qs().offset)
    try {
      const { body, mime } = await this.subtitleService.readTrack(
        track,
        videoPath,
        // Size in the key: a replaced file gets a fresh extraction.
        `${episode.id}-${episode.size}`,
        Number.isFinite(offset) && offset > 0 ? offset : 0
      )
      response.header('Cache-Control', 'private, max-age=3600')
      response.header('Content-Type', mime)
      return response.send(body)
    } catch (e: any) {
      console.error('[Subtitles] extraction failed:', e.shortMessage ?? e.message)
      return response.internalServerError('Could not read this subtitle track')
    }
  }
}
