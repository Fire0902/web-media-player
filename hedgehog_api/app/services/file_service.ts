import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import Anime from '#models/anime'
import Season from '#models/season'
import Episode from '#models/episode'
import app from '@adonisjs/core/services/app'
import { JikanService } from '#services/jikan_service'
import { ThumbnailService } from '#services/thumbnail_service'

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm']
const jikan = new JikanService()
const thumbnails = new ThumbnailService()

async function containsDirectVideos(dirPath: string): Promise<boolean> {
  const entries = await fs.readdir(dirPath)
  return entries.some((f) => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
}

export class FileService {
  private get mediaRoot() {
    return app.makePath('media')
  }

  async sync(): Promise<void> {
    console.log('[FileService] sync() démarré')

    let animeFolders: string[]
    try {
      animeFolders = await fs.readdir(this.mediaRoot)
    } catch (e) {
      console.error('[FileService] ERREUR lecture mediaRoot:', e)
      return
    }

    for (const animeFolder of animeFolders) {
      const animePath = path.join(this.mediaRoot, animeFolder)
      if (!(await fs.stat(animePath)).isDirectory()) continue

      const anime = await Anime.firstOrCreate({ name: animeFolder })

      if (!anime.malId) {
        await this.enrichAnime(anime)
        await anime.refresh()
      }

      const jikanHasEpisodes = anime.malId
        ? await jikan.hasEpisodeData(anime.malId)
        : false

      const hasDirectVideos = await containsDirectVideos(animePath)

      if (hasDirectVideos) {
        await this.syncFlatStructure(anime, animePath, jikanHasEpisodes)
      } else {
        await this.syncSeasonStructure(anime, animePath, jikanHasEpisodes)
      }
    }

    console.log('[FileService] sync() terminé')
  }


  private async syncFlatStructure(
    anime: Anime,
    animePath: string,
    jikanHasEpisodes: boolean
  ): Promise<void> {
    const season = await Season.firstOrCreate(
      { animeId: anime.id, name: 'Season 1' },
      { seasonNumber: 1 }
    )

    if (!season.malId && anime.malId) {
      await this.enrichSeason(season, anime)
    }

    const files = (await fs.readdir(animePath))
      .filter((f) => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort()

    let fallbackIndex = 0

    for (const file of files) {
      const filePath = path.join(animePath, file)
      const stats = await fs.stat(filePath)
      const normalizedPath = filePath.replace(/\\/g, '/')

      const episodeNumber = jikan.parseEpisodeNumber(file) ?? ++fallbackIndex
      const episodeNumberAbsolute = episodeNumber

      const episode = await Episode.updateOrCreate(
        { seasonId: season.id, path: normalizedPath },
        { name: file, size: stats.size, episodeNumber, episodeNumberAbsolute }
      )

      if (!episode.malId && anime.malId && jikanHasEpisodes) {
        await this.enrichEpisode(episode, anime.malId, episodeNumberAbsolute)
      }

      await this.generateThumbnail(episode, filePath)
    }
  }


  private async syncSeasonStructure(
    anime: Anime,
    animePath: string,
    jikanHasEpisodes: boolean
  ): Promise<void> {
    const seasonFolders = (await fs.readdir(animePath)).sort()
    let absoluteEpisodeOffset = 0

    for (const seasonFolder of seasonFolders) {
      const seasonPath = path.join(animePath, seasonFolder)
      if (!(await fs.stat(seasonPath)).isDirectory()) continue

      const seasonNumber = jikan.parseSeasonNumber(seasonFolder)
      const season = await Season.firstOrCreate(
        { animeId: anime.id, name: seasonFolder },
        { seasonNumber }
      )

      if (!season.malId && anime.malId) {
        await this.enrichSeason(season, anime)
      }

      const files = (await fs.readdir(seasonPath))
        .filter((f) => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
        .sort()

      let fallbackIndex = 0

      for (const file of files) {
        const filePath = path.join(seasonPath, file)
        const stats = await fs.stat(filePath)
        const normalizedPath = filePath.replace(/\\/g, '/')

        const episodeNumber = jikan.parseEpisodeNumber(file) ?? ++fallbackIndex
        const episodeNumberAbsolute = absoluteEpisodeOffset + episodeNumber

        const episode = await Episode.updateOrCreate(
          { seasonId: season.id, path: normalizedPath },
          { name: file, size: stats.size, episodeNumber, episodeNumberAbsolute }
        )

        if (!episode.malId && anime.malId && jikanHasEpisodes) {
          await this.enrichEpisode(episode, anime.malId, episodeNumberAbsolute)
        }

        await this.generateThumbnail(episode, filePath)
      }

      absoluteEpisodeOffset += season.episodeCount ?? files.length
    }
  }


  private async generateThumbnail(episode: Episode, filePath: string): Promise<void> {
    if (episode.thumbnailPath) return

    const thumbnailPath = await thumbnails.generate(filePath, episode.id)
    if (thumbnailPath) {
      await episode.merge({ thumbnailPath }).save()
    }
  }


  private async enrichAnime(anime: Anime) {
    try {
      console.log(`[Jikan] recherche anime: "${anime.name}"`)
      const data = await jikan.searchAnime(anime.name)
      if (!data) return

      console.log(`[Jikan] trouvé: "${data.title}" (mal_id: ${data.mal_id})`)

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

  async index() {
    return Anime.query().preload('seasons', (q) => q.preload('episodes'))
  }

  startWatcher(): void {
    console.log('[FileService] watcher démarré sur', this.mediaRoot)
    chokidar
      .watch(this.mediaRoot, { depth: 2, ignoreInitial: true })
      .on('add', () => this.sync())
      .on('unlink', () => this.sync())
      .on('addDir', () => this.sync())
      .on('unlinkDir', () => this.sync())
  }
}