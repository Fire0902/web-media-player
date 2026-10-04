import { defineStore } from 'pinia'
import api from '@/utils/api'
import { useFileStore } from '@/utils/fileStore'
import type { Anime, Episode, EpisodeContext, EpisodeProgress } from '@/types/media'

interface ProgressState {
  /** Watch state keyed by episode id. */
  byEpisode: Record<number, EpisodeProgress>
  /** Ids of the animes the user starred. */
  favoriteIds: number[]
  loaded: boolean
}

/** Maximum number of cards in the home page rows. */
const ROW_LIMIT = 20

/** Every episode of an anime in viewing order. */
function orderedEpisodes(anime: Anime): Episode[] {
  return anime.seasons.flatMap((season) => season.episodes)
}

/**
 * Per-user watch state: resume positions, watched flags and favorites.
 * Combined with the library (`fileStore`) it derives the home page rows
 * "Continue watching" and "Next up".
 */
export const useProgressStore = defineStore('progress', {
  state: (): ProgressState => ({
    byEpisode: {},
    favoriteIds: [],
    loaded: false,
  }),

  getters: {
    isWatched: (state) => (episodeId: number): boolean =>
      Boolean(state.byEpisode[episodeId]?.watched),

    /** Resume position in seconds, 0 when the episode was never started. */
    positionOf: (state) => (episodeId: number): number =>
      state.byEpisode[episodeId]?.position ?? 0,

    /** Share of the episode already played, between 0 and 1. */
    ratioOf: (state) => (episode: Episode): number => {
      const position = state.byEpisode[episode.id]?.position ?? 0
      if (!episode.duration || position <= 0) return 0
      return Math.min(1, position / episode.duration)
    },

    isFavorite: (state) => (animeId: number): boolean => state.favoriteIds.includes(animeId),

    /** Episodes started but not finished, most recent first. */
    continueWatching(state): EpisodeContext[] {
      const fileStore = useFileStore()
      const items: { context: EpisodeContext; at: string }[] = []
      for (const anime of fileStore.animes) {
        for (const season of anime.seasons) {
          for (const episode of season.episodes) {
            const progress = state.byEpisode[episode.id]
            if (progress && !progress.watched && progress.position > 0) {
              items.push({ context: { episode, season, anime }, at: progress.updatedAt ?? '' })
            }
          }
        }
      }
      return items
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, ROW_LIMIT)
        .map((item) => item.context)
    },

    /**
     * For each anime being followed, the first unwatched episode after
     * the last watched one. Shows already listed in "Continue watching"
     * are left out.
     */
    nextUp(state): EpisodeContext[] {
      const fileStore = useFileStore()
      const items: { context: EpisodeContext; at: string }[] = []

      for (const anime of fileStore.animes) {
        const episodes = orderedEpisodes(anime)
        const inProgress = episodes.some((episode) => {
          const progress = state.byEpisode[episode.id]
          return progress && !progress.watched && progress.position > 0
        })
        if (inProgress) continue

        let lastWatchedIndex = -1
        episodes.forEach((episode, index) => {
          if (state.byEpisode[episode.id]?.watched) lastWatchedIndex = index
        })
        if (lastWatchedIndex < 0) continue

        const next = episodes
          .slice(lastWatchedIndex + 1)
          .find((episode) => !state.byEpisode[episode.id]?.watched)
        if (!next) continue

        const season = anime.seasons.find((s) => s.id === next.seasonId)
        if (!season) continue
        const lastWatched = episodes[lastWatchedIndex]
        items.push({
          context: { episode: next, season, anime },
          at: (lastWatched && state.byEpisode[lastWatched.id]?.updatedAt) ?? '',
        })
      }

      return items
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, ROW_LIMIT)
        .map((item) => item.context)
    },
  },

  actions: {
    /** Fetch the user's whole watch state (progress + favorites). */
    async load() {
      const [progress, favorites] = await Promise.all([
        api.get<EpisodeProgress[]>('/progress'),
        api.get<number[]>('/favorites'),
      ])
      this.byEpisode = Object.fromEntries(progress.data.map((row) => [row.episodeId, row]))
      this.favoriteIds = favorites.data
      this.loaded = true
    },

    /** Load once per session; later calls are no-ops. */
    async ensureLoaded() {
      if (!this.loaded) await this.load()
    },

    /** Forget everything (on logout). */
    reset() {
      this.byEpisode = {}
      this.favoriteIds = []
      this.loaded = false
    },

    apply(rows: EpisodeProgress[]) {
      for (const row of rows) this.byEpisode[row.episodeId] = row
    },

    /** Send the player's current position; the server decides "watched". */
    async report(
      episodeId: number,
      payload: { position: number; duration: number | null; method: string; paused: boolean },
    ) {
      const { data } = await api.put<EpisodeProgress>(`/episodes/${episodeId}/progress`, payload)
      this.apply([data])
    },

    async setEpisodeWatched(episodeId: number, watched: boolean) {
      const { data } = await api.put<EpisodeProgress[]>(`/episodes/${episodeId}/watched`, { watched })
      this.apply(data)
    },

    async setSeasonWatched(seasonId: number, watched: boolean) {
      const { data } = await api.put<EpisodeProgress[]>(`/seasons/${seasonId}/watched`, { watched })
      this.apply(data)
    },

    async setAnimeWatched(animeId: number, watched: boolean) {
      const { data } = await api.put<EpisodeProgress[]>(`/animes/${animeId}/watched`, { watched })
      this.apply(data)
    },

    async toggleFavorite(animeId: number) {
      const favorite = !this.favoriteIds.includes(animeId)
      await api.put(`/animes/${animeId}/favorite`, { favorite })
      this.favoriteIds = favorite
        ? [...this.favoriteIds, animeId]
        : this.favoriteIds.filter((id) => id !== animeId)
    },

    /**
     * Episode to launch from an anime's "Play" button: the one in
     * progress, else the first unwatched, else the very first.
     */
    resumeTarget(anime: Anime): Episode | null {
      const episodes = orderedEpisodes(anime)
      const started = episodes.find((episode) => {
        const progress = this.byEpisode[episode.id]
        return progress && !progress.watched && progress.position > 0
      })
      if (started) return started

      let lastWatchedIndex = -1
      episodes.forEach((episode, index) => {
        if (this.byEpisode[episode.id]?.watched) lastWatchedIndex = index
      })
      const next = episodes
        .slice(lastWatchedIndex + 1)
        .find((episode) => !this.byEpisode[episode.id]?.watched)
      return next ?? episodes[0] ?? null
    },
  },
})
