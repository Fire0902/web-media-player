import { defineStore } from 'pinia'
import api from '@/utils/api'
import type { Anime, Episode } from '@/types/media'

export type { Anime, Episode, Season, VoiceActor } from '@/types/media'

interface MediaState {
  animes: Anime[]
  loading: boolean
  error: Error | null
}

/**
 * Holds the catalogue of animes returned by the backend.
 * Components read `animes` for the library view and `allEpisodes`
 * for cross-anime lookups (e.g. resolving a player route by episode id).
 */
export const useFileStore = defineStore('file', {
  state: (): MediaState => ({
    animes: [],
    loading: false,
    error: null,
  }),

  getters: {
    /** Flattened list of every episode across every anime/season. */
    allEpisodes: (state): Episode[] =>
      state.animes.flatMap(anime =>
        anime.seasons.flatMap(season => season.episodes),
      ),
  },

  actions: {
    /** Fetch the full library from the API and cache it in the store. */
    async getAll() {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get<Anime[]>('/files')
        this.animes = data
      } catch (err: any) {
        this.error = err
      } finally {
        this.loading = false
      }
    },
  },
})
