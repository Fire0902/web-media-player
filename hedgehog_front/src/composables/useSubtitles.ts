import { onUnmounted, ref, watch, type Ref } from 'vue'
import api from '@/utils/api'
import { useAuthStore } from '@/utils/authStore'
import { useSettingsStore } from '@/utils/settingsStore'
import { API_BASE_URL } from '@/config'
import type { SubtitleTrack } from '@/types/subtitles'

/**
 * Load subtitle tracks for an episode and render whichever the user
 * selects on top of the `<video>` element.
 *
 * ASS/SSA tracks are rendered through JASSUB (libass + WebAssembly).
 * SRT/SUB/VTT tracks rely on the browser's native `<track>` element —
 * the backend converts SRT to VTT on the fly.
 *
 * `streamOffset` is where the current stream starts on the episode's
 * timeline (non-zero after seeking in a converted stream, whose clock
 * restarts at zero). Subtitles are shifted by that amount to stay in
 * sync.
 *
 * The composable owns the JASSUB instance and destroys it whenever the
 * episode changes or the selected track is cleared.
 */
export function useSubtitles(
  videoRef: Ref<HTMLVideoElement | null>,
  episodeId: Ref<string | null>,
  streamOffset: Ref<number>,
) {
  const authStore = useAuthStore()
  const settings = useSettingsStore()

  const tracks = ref<SubtitleTrack[]>([])
  const selectedTrackId = ref<string | null>(null)
  /** Whether the currently selected track is rendered via JASSUB. */
  const isAssActive = ref(false)
  /** URL of the active native (VTT) track, if any. */
  const nativeTrackUrl = ref<string | null>(null)

  // Lazily-loaded JASSUB instance — only when an ASS track is picked.
  let jassub: any = null
  /** Guards against a slow track list landing after an episode change. */
  let refreshToken = 0

  /** Public-facing URL pointing at a subtitle file for this episode. */
  function buildTrackUrl(trackId: string, offset = 0): string {
    const params = new URLSearchParams({ token: authStore.token ?? '' })
    if (offset > 0) params.set('offset', offset.toFixed(3))
    return `${API_BASE_URL}/episodes/${episodeId.value}/subtitles/${trackId}?${params.toString()}`
  }

  /** Tear down any active renderer. */
  function clearRenderer() {
    if (jassub) {
      try { jassub.destroy() } catch { /* already gone */ }
      jassub = null
    }
    isAssActive.value = false
    nativeTrackUrl.value = null
  }

  async function loadJassubFor(track: SubtitleTrack) {
    if (!videoRef.value) return
    clearRenderer()

    // Dynamic import keeps JASSUB (and its wasm) out of the main bundle.
    const [{ default: JASSUB }, workerUrl, wasmUrl] = await Promise.all([
      import('jassub'),
      import('jassub/dist/wasm/jassub-worker.js?url').then((m) => m.default),
      import('jassub/dist/wasm/jassub-worker.wasm?url').then((m) => m.default),
    ])

    // The user may have switched track or episode while the wasm loaded.
    if (selectedTrackId.value !== track.id || !videoRef.value) return

    jassub = new JASSUB({
      video: videoRef.value,
      subUrl: buildTrackUrl(track.id),
      workerUrl,
      wasmUrl,
      timeOffset: streamOffset.value,
    })
    isAssActive.value = true
  }

  function loadNativeTrack(track: SubtitleTrack) {
    clearRenderer()
    nativeTrackUrl.value = buildTrackUrl(track.id, streamOffset.value)
  }

  /** Switch (or clear) the displayed subtitle track. */
  async function selectTrack(trackId: string | null) {
    selectedTrackId.value = trackId
    if (!trackId) {
      clearRenderer()
      return
    }
    const track = tracks.value.find((candidate) => candidate.id === trackId)
    if (!track) return

    if (track.format === 'ass' || track.format === 'ssa') {
      await loadJassubFor(track)
    } else {
      loadNativeTrack(track)
    }
  }

  /** Fetch the list of available tracks for the current episode. */
  async function refresh() {
    const token = ++refreshToken
    if (!episodeId.value) {
      tracks.value = []
      selectedTrackId.value = null
      clearRenderer()
      return
    }
    let loaded: SubtitleTrack[] = []
    try {
      const { data } = await api.get<SubtitleTrack[]>(
        `/episodes/${episodeId.value}/subtitles`,
      )
      loaded = data
    } catch {
      /* no subtitles for this episode */
    }
    if (token !== refreshToken) return
    tracks.value = loaded

    // Auto-pick the user's preferred language if it matches a track.
    const preferred = settings.preferredSubtitleLabel.trim().toLowerCase()
    const auto = preferred
      ? tracks.value.find((track) => {
          const label = track.label.toLowerCase()
          return label === preferred || label.startsWith(preferred)
        })
      : null
    await selectTrack(auto ? auto.id : null)
  }

  // Re-fetch and re-render every time the episode changes.
  watch(episodeId, refresh, { immediate: true })

  // The stream restarted somewhere else: realign the active track.
  watch(streamOffset, (offset) => {
    if (jassub) {
      jassub.timeOffset = offset
    } else if (nativeTrackUrl.value && selectedTrackId.value) {
      nativeTrackUrl.value = buildTrackUrl(selectedTrackId.value, offset)
    }
  })

  onUnmounted(clearRenderer)

  return {
    tracks,
    selectedTrackId,
    isAssActive,
    nativeTrackUrl,
    selectTrack,
    refresh,
  }
}
