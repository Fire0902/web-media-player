/**
 * Domain types describing the media library returned by the API.
 * Kept separate from the store so components can import the shape
 * without dragging Pinia into their dependency graph.
 */

export interface VoiceActor {
  characterName: string
  characterImage: string
  actorName: string
  actorImage: string
}

export interface Episode {
  id: number
  name: string
  path: string
  size: number
  thumbnailPath: string | null
  episodeNumber: number | null
  episodeNumberAbsolute: number | null
  title: string | null
  titleJapanese: string | null
  airedAt: string | null
  filler: boolean
  recap: boolean
  voiceActors: VoiceActor[] | null
}

export interface Season {
  id: number
  name: string
  seasonNumber: number | null
  episodeCount: number | null
  status: string | null
  airedFrom: string | null
  coverUrl: string | null
  episodes: Episode[]
}

export interface Anime {
  id: number
  name: string
  malId: number | null
  synopsis: string | null
  coverUrl: string | null
  status: string | null
  totalEpisodes: number | null
  rating: string | null
  genres: string[] | null
  studios: string[] | null
  voiceActors: VoiceActor[] | null
  seasons: Season[]
}

export type AiringStatus = 'Currently Airing' | 'Finished Airing' | string

export type NumberingMode = 'season' | 'absolute'
