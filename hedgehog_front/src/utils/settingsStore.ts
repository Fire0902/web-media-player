import { defineStore } from 'pinia'

/**
 * User preferences stored locally (no server round-trip).
 *
 *   - `transcodingEnabled` + `quality`: force a server-side downscale.
 *     With transcoding off (or `source`) the server picks the cheapest
 *     way to play each file: direct play, remux, or a same-resolution
 *     transcode when the codec isn't browser-friendly.
 *   - `preferredSubtitleLabel` / `preferredAudioLanguage`: tracks
 *     selected automatically when an episode starts.
 *   - `autoplayNext`: chain episodes like a binge session.
 */

export type StreamQuality = '360p' | '480p' | '720p' | '1080p' | 'source'

export const STREAM_QUALITIES: StreamQuality[] = [
  '360p',
  '480p',
  '720p',
  '1080p',
  'source',
]

interface SettingsState {
  transcodingEnabled: boolean
  quality: StreamQuality
  /** Preferred subtitle language label, e.g. "fr". Empty disables subs. */
  preferredSubtitleLabel: string
  /** Preferred audio language, e.g. "jpn". Empty keeps the file's default. */
  preferredAudioLanguage: string
  /** Start the next episode automatically when one ends. */
  autoplayNext: boolean
}

const STORAGE_KEY = 'hedgehog.settings'

/** Read whatever is in localStorage, falling back to safe defaults. */
function loadFromStorage(): SettingsState {
  const defaults: SettingsState = {
    transcodingEnabled: false,
    quality: 'source',
    preferredSubtitleLabel: '',
    preferredAudioLanguage: '',
    autoplayNext: true,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return {
      transcodingEnabled: Boolean(parsed.transcodingEnabled ?? defaults.transcodingEnabled),
      quality: STREAM_QUALITIES.includes(parsed.quality as StreamQuality)
        ? (parsed.quality as StreamQuality)
        : defaults.quality,
      preferredSubtitleLabel: parsed.preferredSubtitleLabel ?? defaults.preferredSubtitleLabel,
      preferredAudioLanguage: parsed.preferredAudioLanguage ?? defaults.preferredAudioLanguage,
      autoplayNext: Boolean(parsed.autoplayNext ?? defaults.autoplayNext),
    }
  } catch {
    return defaults
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => loadFromStorage(),

  getters: {
    /**
     * Effective quality to send on the stream URL. When transcoding is
     * disabled or `quality === 'source'`, returns null so the caller
     * can skip the query parameter entirely.
     */
    effectiveQuality(state): Exclude<StreamQuality, 'source'> | null {
      if (!state.transcodingEnabled) return null
      if (state.quality === 'source') return null
      return state.quality
    },
  },

  actions: {
    /** Persist the current state to localStorage. */
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        /* quota / private mode → ignore */
      }
    },

    setTranscodingEnabled(enabled: boolean) {
      this.transcodingEnabled = enabled
      if (!enabled) this.quality = 'source'
      this.persist()
    },

    setQuality(quality: StreamQuality) {
      this.quality = quality
      // Picking a target quality from the player implies transcoding.
      this.transcodingEnabled = quality !== 'source'
      this.persist()
    },

    setPreferredSubtitle(label: string) {
      this.preferredSubtitleLabel = label
      this.persist()
    },

    setPreferredAudioLanguage(language: string) {
      this.preferredAudioLanguage = language
      this.persist()
    },

    setAutoplayNext(enabled: boolean) {
      this.autoplayNext = enabled
      this.persist()
    },
  },
})
