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
  seasonId: number
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
  /** Runtime in seconds, filled in by the server's ffprobe pass. */
  duration: number | null
  container: string | null
  videoCodec: string | null
  audioCodec: string | null
  width: number | null
  height: number | null
  createdAt: string
}

export interface Season {
  id: number
  animeId: number
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
  createdAt: string
}

export type AiringStatus = 'Currently Airing' | 'Finished Airing' | string

export type NumberingMode = 'season' | 'absolute'

/** Per-user watch state of one episode. */
export interface EpisodeProgress {
  episodeId: number
  /** Resume position in seconds (0 once the episode is finished). */
  position: number
  watched: boolean
  updatedAt: string | null
}

/** How the server delivers a file to the browser. */
export type PlaybackMethod = 'direct' | 'remux' | 'transcode'

export interface AudioTrack {
  index: number
  codec: string
  channels: number
  language: string | null
  title: string | null
  default: boolean
}

export interface Chapter {
  start: number
  end: number
  title: string | null
}

/** Technical description of an episode's file (`GET /episodes/:id/media`). */
export interface MediaInfo {
  method: PlaybackMethod
  canCopyVideo: boolean
  size: number
  duration: number | null
  container: string
  bitRate: number | null
  video: {
    codec: string
    profile: string | null
    width: number
    height: number
    pixelFormat: string | null
    frameRate: number | null
  } | null
  audio: AudioTrack[]
  chapters: Chapter[]
}

/** An episode together with the anime and season it belongs to. */
export interface EpisodeContext {
  episode: Episode
  season: Season
  anime: Anime
}
