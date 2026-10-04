import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import Anime from '#models/anime'
import Season from '#models/season'
import Episode from '#models/episode'
import UserEpisodeProgress from '#models/user_episode_progress'
import UserAnimeFavorite from '#models/user_anime_favorite'
import app from '@adonisjs/core/services/app'
import { JikanService } from '#services/jikan_service'
import { ThumbnailService } from '#services/thumbnail_service'
import { MediaInfoService } from '#services/media_info_service'

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']
const jikan = new JikanService()
const thumbnails = new ThumbnailService()
const mediaInfo = new MediaInfoService()

/** Wait this long after the last filesystem event before rescanning. */
const WATCHER_DEBOUNCE_MS = 3000
/** SQLite caps the number of bound parameters per statement. */
const DELETE_CHUNK_SIZE = 400

export interface ScanState {
  scanning: boolean
  lastScanAt: string | null
  lastDurationMs: number | null
  lastError: string | null
}

/**
 * Shared across every `FileService` instance: the controller gets a
 * fresh one per request while the boot hook keeps its own.
 */
const scanState: ScanState & { pending: boolean } = {
  scanning: false,
  pending: false,
  lastScanAt: null,
  lastDurationMs: null,
  lastError: null,
}

/** Lazily tells whether MyAnimeList has per-episode data for an anime. */
type EpisodeDataCheck = () => Promise<boolean>

export class MetadataConflictError extends Error {}
export class MetadataNotFoundError extends Error {}

function isVideo(fileName: string): boolean {
  return VIDEO_EXTENSIONS.includes(path.extname(fileName).toLowerCase())
}

async function containsDirectVideos(dirPath: string): Promise<boolean> {
  const entries = await fs.readdir(dirPath)
  return entries.some(isVideo)
}

/** True when the folder holds at least one video, directly or one level down. */
async function containsAnyVideo(dirPath: string): Promise<boolean> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  if (entries.some((entry) => entry.isFile() && isVideo(entry.name))) return true
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      if (await containsDirectVideos(path.join(dirPath, entry.name))) return true
    } catch {
      /* unreadable sub-folder */
    }
  }
  return false
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export class FileService {
  private get mediaRoot() {
    return app.makePath('media')
  }

  /** Snapshot of the scanner, shown on the admin dashboard. */
  scanStatus(): ScanState {
    const { pending, ...state } = scanState
    return state
  }

  /**
   * Walk the media folder and mirror it in the database.
   *
   * Only one scan runs at a time: a request arriving mid-scan is
   * remembered and replayed once the current pass is over, so a burst
   * of filesystem events never piles up concurrent scans.
   */
  async sync(): Promise<void> {
    if (scanState.scanning) {
      scanState.pending = true
      return
    }

    scanState.scanning = true
    const startedAt = Date.now()
    try {
      do {
        scanState.pending = false
        await this.runSync()
      } while (scanState.pending)
      scanState.lastError = null
    } catch (e: any) {
      scanState.lastError = e?.message ?? String(e)
      console.error('[FileService] sync() a échoué:', e)
    } finally {
      scanState.scanning = false
      scanState.lastScanAt = new Date().toISOString()
      scanState.lastDurationMs = Date.now() - startedAt
    }
  }

  private async runSync(): Promise<void> {
    console.log('[FileService] sync() démarré')

    let animeFolders: string[]
    try {
      animeFolders = await fs.readdir(this.mediaRoot)
    } catch (e) {
      console.error('[FileService] ERREUR lecture mediaRoot:', e)
      throw new Error('Media folder is not readable.')
    }

    const seenAnimeNames = new Set<string>()
    const seenEpisodePaths = new Set<string>()

    for (const animeFolder of animeFolders) {
      const animePath = path.join(this.mediaRoot, animeFolder)
      if (!(await fs.stat(animePath)).isDirectory()) continue
      // Empty folders aren't shows yet; they appear once a video lands.
      if (!(await containsAnyVideo(animePath))) continue

      seenAnimeNames.add(animeFolder)
      const anime = await Anime.firstOrCreate({ name: animeFolder })

      if (!anime.malId) {
        await this.enrichAnime(anime)
        await anime.refresh()
      }

      // Asked at most once per anime, and only if an episode still
      // lacks metadata: a fully enriched library scans without network.
      let episodeDataCheck: Promise<boolean> | null = null
      const jikanHasEpisodes: EpisodeDataCheck = () => {
        if (!anime.malId) return Promise.resolve(false)
        episodeDataCheck ??= jikan.hasEpisodeData(anime.malId)
        return episodeDataCheck
      }

      const hasDirectVideos = await containsDirectVideos(animePath)

      if (hasDirectVideos) {
        await this.syncFlatStructure(anime, animePath, jikanHasEpisodes, seenEpisodePaths)
      } else {
        await this.syncSeasonStructure(anime, animePath, jikanHasEpisodes, seenEpisodePaths)
      }
    }

    // An empty root usually means an unmounted drive, not a wiped
    // library: keep the database (and everyone's watch history) intact.
    if (seenAnimeNames.size > 0) {
      await this.prune(seenAnimeNames, seenEpisodePaths)
    }

    console.log('[FileService] sync() terminé')
  }

  private async syncFlatStructure(
    anime: Anime,
    animePath: string,
    jikanHasEpisodes: EpisodeDataCheck,
    seenEpisodePaths: Set<string>
  ): Promise<void> {
    const season = await Season.firstOrCreate(
      { animeId: anime.id, name: 'Season 1' },
      { seasonNumber: 1 }
    )

    if (!season.malId && anime.malId) {
      await this.enrichSeason(season, anime)
    }

    await this.syncEpisodes(anime, season, animePath, 0, jikanHasEpisodes, seenEpisodePaths)
  }

  private async syncSeasonStructure(
    anime: Anime,
    animePath: string,
    jikanHasEpisodes: EpisodeDataCheck,
    seenEpisodePaths: Set<string>
  ): Promise<void> {
    const seasonFolders = (await fs.readdir(animePath)).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
    let absoluteEpisodeOffset = 0

    for (const seasonFolder of seasonFolders) {
      const seasonPath = path.join(animePath, seasonFolder)
      if (!(await fs.stat(seasonPath)).isDirectory()) continue
      if (!(await containsDirectVideos(seasonPath))) continue

      const seasonNumber = jikan.parseSeasonNumber(seasonFolder)
      const season = await Season.firstOrCreate(
        { animeId: anime.id, name: seasonFolder },
        { seasonNumber }
      )

      if (!season.malId && anime.malId) {
        await this.enrichSeason(season, anime)
      }

      const fileCount = await this.syncEpisodes(
        anime,
        season,
        seasonPath,
        absoluteEpisodeOffset,
        jikanHasEpisodes,
        seenEpisodePaths
      )

      absoluteEpisodeOffset += season.episodeCount ?? fileCount
    }
  }

  /** Upsert every video of one folder as an episode of `season`. */
  private async syncEpisodes(
    anime: Anime,
    season: Season,
    folderPath: string,
    absoluteEpisodeOffset: number,
    jikanHasEpisodes: EpisodeDataCheck,
    seenEpisodePaths: Set<string>
  ): Promise<number> {
    const files = (await fs.readdir(folderPath))
      .filter(isVideo)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    let fallbackIndex = 0

    for (const file of files) {
      const filePath = path.join(folderPath, file)
      const stats = await fs.stat(filePath)
      const normalizedPath = filePath.replace(/\\/g, '/')
      seenEpisodePaths.add(normalizedPath)

      const episodeNumber = jikan.parseEpisodeNumber(file) ?? ++fallbackIndex
      const episodeNumberAbsolute = absoluteEpisodeOffset + episodeNumber

      const episode = await Episode.updateOrCreate(
        { seasonId: season.id, path: normalizedPath },
        { name: file, size: stats.size, episodeNumber, episodeNumberAbsolute }
      )

      if (!episode.malId && anime.malId && (await jikanHasEpisodes())) {
        await this.enrichEpisode(episode, anime.malId, episodeNumberAbsolute)
      }

      await this.probeEpisode(episode, filePath)
      await this.generateThumbnail(episode, filePath)
    }

    return files.length
  }

  /**
   * Drop database rows whose file or folder disappeared, along with
   * the per-user data hanging off them.
   */
  private async prune(seenAnimeNames: Set<string>, seenEpisodePaths: Set<string>): Promise<void> {
    const staleEpisodes = (await Episode.query().select('id', 'path')).filter(
      (episode) => !seenEpisodePaths.has(episode.path)
    )

    if (staleEpisodes.length > 0) {
      const ids = staleEpisodes.map((episode) => episode.id)
      for (const batch of chunk(ids, DELETE_CHUNK_SIZE)) {
        await UserEpisodeProgress.query().whereIn('episode_id', batch).delete()
        await Episode.query().whereIn('id', batch).delete()
      }
      for (const id of ids) await thumbnails.remove(id)
      await this.removeSubtitleCache(ids)
      console.log(`[FileService] ${ids.length} épisode(s) supprimé(s) de la base`)
    }

    const emptySeasons = await Season.query().whereDoesntHave('episodes', () => {})
    for (const season of emptySeasons) await season.delete()

    const staleAnimes = (await Anime.all()).filter((anime) => !seenAnimeNames.has(anime.name))
    for (const anime of staleAnimes) {
      await UserAnimeFavorite.query().where('anime_id', anime.id).delete()
      await Season.query().where('anime_id', anime.id).delete()
      await anime.delete()
    }
  }

  /** Delete the subtitle tracks extracted from episodes that no longer exist. */
  private async removeSubtitleCache(episodeIds: number[]): Promise<void> {
    const cacheDir = app.makePath('tmp/subtitles')
    let files: string[]
    try {
      files = await fs.readdir(cacheDir)
    } catch {
      return
    }
    const prefixes = episodeIds.map((id) => `${id}-`)
    for (const file of files) {
      if (prefixes.some((prefix) => file.startsWith(prefix))) {
        await fs.unlink(path.join(cacheDir, file)).catch(() => {})
      }
    }
  }

  /** Store duration / codecs / resolution the first time a file is seen. */
  private async probeEpisode(episode: Episode, filePath: string): Promise<void> {
    if (episode.duration) return

    const info = await mediaInfo.probe(filePath)
    if (!info) return

    await episode
      .merge({
        duration: info.duration,
        container: info.container,
        videoCodec: info.video?.codec ?? null,
        audioCodec: info.audio[0]?.codec ?? null,
        width: info.video?.width ?? null,
        height: info.video?.height ?? null,
      })
      .save()
  }

  private async generateThumbnail(episode: Episode, filePath: string): Promise<void> {
    if (episode.thumbnailPath) return

    // Aim past the opening, but stay inside short videos.
    const offsetSeconds = episode.duration ? Math.min(300, episode.duration * 0.25) : 300
    const thumbnailPath = await thumbnails.generate(filePath, episode.id, offsetSeconds)
    if (thumbnailPath) {
      await episode.merge({ thumbnailPath }).save()
    }
  }

  private async applyAnimeData(anime: Anime, data: any) {
    const characters = await jikan.getAnimeCharacters(data.mal_id)
    const voiceActors = jikan.extractVoiceActors(characters)

    await anime
      .merge({
        malId: data.mal_id,
        synopsis: data.synopsis ?? null,
        coverUrl: data.images?.jpg?.large_image_url ?? data.images?.jpg?.image_url ?? null,
        status: data.status ?? null,
        totalEpisodes: data.episodes ?? null,
        rating: data.rating ?? null,
        genres: data.genres?.map((g: any) => g.name) ?? [],
        studios: data.studios?.map((s: any) => s.name) ?? [],
        voiceActors,
      })
      .save()
  }

  private async enrichAnime(anime: Anime) {
    try {
      console.log(`[Jikan] recherche anime: "${anime.name}"`)
      const data = await jikan.searchAnime(anime.name)
      if (!data) return

      console.log(`[Jikan] trouvé: "${data.title}" (mal_id: ${data.mal_id})`)

      // `mal_id` is unique: two folders resolving to the same entry
      // would otherwise abort the whole scan.
      const owner = await Anime.findBy('malId', data.mal_id)
      if (owner && owner.id !== anime.id) {
        console.warn(`[Jikan] mal_id ${data.mal_id} déjà utilisé par "${owner.name}", ignoré`)
        return
      }

      await this.applyAnimeData(anime, data)

      console.log(`[Jikan] anime enrichi: "${anime.name}" ✓`)
    } catch (e) {
      console.error(`[Jikan] erreur enrichissement anime "${anime.name}":`, e)
    }
  }

  private async enrichSeason(season: Season, anime: Anime) {
    try {
      await season
        .merge({ malId: anime.malId, coverUrl: anime.coverUrl, status: anime.status })
        .save()
    } catch (e) {
      console.error(`[Jikan] erreur enrichissement saison "${season.name}":`, e)
    }
  }

  private async enrichEpisode(episode: Episode, malId: number, episodeNumberAbsolute: number) {
    try {
      const data = await jikan.getEpisode(malId, episodeNumberAbsolute)
      if (!data) return

      await episode
        .merge({
          malId: data.mal_id ?? null,
          title: data.title ?? null,
          titleJapanese: data.title_japanese ?? null,
          airedAt: data.aired ?? null,
          filler: data.filler ?? false,
          recap: data.recap ?? false,
        })
        .save()

      console.log(
        `[Jikan] épisode enrichi: "${episode.name}" → #${episodeNumberAbsolute} "${data.title}" ✓`
      )
    } catch (e) {
      console.error(`[Jikan] erreur enrichissement épisode "${episode.name}":`, e)
    }
  }

  /**
   * Re-fetch an anime's metadata. With `malId` the match is forced to
   * that MyAnimeList entry ("identify"); without it the folder name is
   * searched again. Episode metadata is reset and refilled by the scan
   * that follows.
   */
  async refreshMetadata(animeId: number, malId?: number): Promise<Anime> {
    const anime = await Anime.findOrFail(animeId)

    const data = malId ? await jikan.getAnime(malId) : await jikan.searchAnime(anime.name)
    if (!data) {
      throw new MetadataNotFoundError('No MyAnimeList entry found.')
    }

    const owner = await Anime.findBy('malId', data.mal_id)
    if (owner && owner.id !== anime.id) {
      throw new MetadataConflictError(`This entry is already linked to "${owner.name}".`)
    }

    await this.applyAnimeData(anime, data)

    const seasons = await Season.query().where('anime_id', anime.id)
    for (const season of seasons) {
      await this.enrichSeason(season, anime)
      await Episode.query().where('season_id', season.id).update({
        mal_id: null,
        title: null,
        title_japanese: null,
        aired_at: null,
        filler: false,
        recap: false,
      })
    }

    void this.sync()
    return anime
  }

  async index() {
    return Anime.query()
      .orderBy('name', 'asc')
      .preload('seasons', (seasons) =>
        seasons
          .orderBy('season_number', 'asc')
          .orderBy('id', 'asc')
          .preload('episodes', (episodes) =>
            episodes.orderBy('episode_number', 'asc').orderBy('id', 'asc')
          )
      )
  }

  startWatcher(): void {
    console.log('[FileService] watcher démarré sur', this.mediaRoot)

    // Copying a season fires one event per file: wait for the dust to
    // settle before scanning.
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void this.sync(), WATCHER_DEBOUNCE_MS)
    }

    chokidar
      .watch(this.mediaRoot, { depth: 2, ignoreInitial: true })
      .on('add', schedule)
      .on('unlink', schedule)
      .on('addDir', schedule)
      .on('unlinkDir', schedule)
  }
}
