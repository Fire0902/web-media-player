import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface LoadOptions {
  /**
   * True when the URL supports HTTP range requests (direct play).
   * Converted streams (remux / transcode) are sequential: seeking
   * restarts the stream at a new offset.
   */
  seekable: boolean
  /** Where playback should start, in seconds of the full episode. */
  position: number
  /** Start playing as soon as the stream is ready. */
  autoplay: boolean
}

interface VideoPlayerOptions {
  wrapperSelector?: string
  /** Episode runtime known by the server; converted streams don't expose one. */
  knownDuration: Ref<number | null>
  /**
   * Converted streams that copy the video can only start on a keyframe:
   * maps a wanted position to where the stream will really begin.
   */
  resolveStart?: (seconds: number) => Promise<number>
}

const VOLUME_STORAGE_KEY = 'hedgehog.volume'

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
  const stored = raw === null ? Number.NaN : Number(raw)
  return stored >= 0 && stored <= 1 ? stored : 1
}

/**
 * Encapsulates all imperative `<video>` interactions used by the player.
 *
 * The composable returns reactive state (play status, time, volume, etc.)
 * and a set of imperative actions. The host component must bind the
 * returned `videoRef` and `activeSrc` to its `<video>` element and
 * forward the relevant media events (timeupdate, loadedmetadata, play,
 * pause).
 *
 * Time is always expressed on the episode's own timeline. A converted
 * stream that was started mid-episode restarts its clock at zero, so
 * `offset` (where the stream begins) is added back to every reading.
 *
 * Three timers are managed internally:
 *   - `hideControlsTimer` auto-hides the overlay during playback;
 *   - `seekHintTimer` clears the +/- 5s hint after a short delay;
 *   - `seekTimer` debounces scrubbing on converted streams, where each
 *     seek means a new ffmpeg process on the server.
 */
export function useVideoPlayer({
  wrapperSelector = '.vp-wrapper',
  knownDuration,
  resolveStart,
}: VideoPlayerOptions) {
  const videoRef: Ref<HTMLVideoElement | null> = ref(null)

  /** URL currently bound to the `<video>` element. */
  const activeSrc = ref('')
  /** Episode time at which the current stream starts (0 for direct play). */
  const offset = ref(0)
  /** Whether the current stream supports native seeking (direct play). */
  const isSeekable = ref(true)

  const hasStarted = ref(false)
  const isPlaying = ref(false)
  const isBuffering = ref(false)
  const showControls = ref(true)
  const volume = ref(loadVolume())
  const playbackSpeed = ref(1)
  const isFullscreen = ref(false)
  const currentTime = ref(0)
  const seekHint = ref<'left' | 'right' | null>(null)
  /** Duration read from the element, used when the server knows none. */
  const elementDuration = ref(0)

  const duration = computed(() => knownDuration.value || elementDuration.value)

  const AVAILABLE_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const HIDE_DELAY_MS = 3000
  const SEEK_HINT_DELAY_MS = 500
  const DOUBLE_TAP_WINDOW_MS = 300
  const SEEK_STEP_SECONDS = 5
  const SEEK_DEBOUNCE_MS = 350

  let hideControlsTimer: ReturnType<typeof setTimeout> | null = null
  let seekHintTimer: ReturnType<typeof setTimeout> | null = null
  let seekTimer: ReturnType<typeof setTimeout> | null = null
  let lastTapTime = 0
  let lastTapSide: 'left' | 'right' | '' = ''

  let baseUrl = ''
  /** Position to jump to once a direct stream has loaded its metadata. */
  let pendingSeek: number | null = null
  let pendingAutoplay = false
  /** Invalidates a `load()` still waiting on `resolveStart`. */
  let loadToken = 0
  /** True while a restart of a converted stream is pending. */
  let isScrubbing = false
  let volumeBeforeMute = 1

  /** `play()` rejects when interrupted by a new load: not an error. */
  function safePlay() {
    videoRef.value?.play().catch(() => {})
  }

  /** Show controls now, then hide them again after `HIDE_DELAY_MS` if still playing. */
  function scheduleHideControls() {
    if (hideControlsTimer) clearTimeout(hideControlsTimer)
    showControls.value = true
    hideControlsTimer = setTimeout(() => {
      if (isPlaying.value) showControls.value = false
    }, HIDE_DELAY_MS)
  }

  /**
   * Point the player at a stream and position it.
   *
   * Direct streams are loaded once and seeked natively. Converted
   * streams get the position baked into the URL (`&start=`), so every
   * call produces a new stream.
   */
  async function load(url: string, options: LoadOptions) {
    const token = ++loadToken
    const position = Math.max(0, options.position)

    baseUrl = url
    isSeekable.value = options.seekable
    pendingAutoplay = options.autoplay
    currentTime.value = position

    if (isSeekable.value) {
      offset.value = 0
      const video = videoRef.value
      if (activeSrc.value === url && video && video.readyState >= 1) {
        video.currentTime = position
        if (options.autoplay) safePlay()
        return
      }
      pendingSeek = position > 0 ? position : null
      activeSrc.value = url
      return
    }

    const start = position > 0 && resolveStart ? await resolveStart(position) : position
    if (token !== loadToken) return

    pendingSeek = null
    offset.value = start
    currentTime.value = start
    const nextSrc = start > 0 ? `${url}&start=${start.toFixed(3)}` : url
    if (nextSrc === activeSrc.value) {
      if (options.autoplay) safePlay()
      return
    }
    activeSrc.value = nextSrc
    if (options.autoplay) {
      // `preload="none"` streams only start loading on play().
      hasStarted.value = true
      // Wait for Vue to push the new `src` onto the element.
      await nextTick()
      if (token === loadToken) safePlay()
    }
  }

  /** Start playback for the first time and flip out of the start-screen state. */
  function startVideo() {
    hasStarted.value = true
    safePlay()
    scheduleHideControls()
  }

  /** Toggle play/pause, falling through to `startVideo` on first interaction. */
  function togglePlay() {
    if (!hasStarted.value) {
      startVideo()
      return
    }
    const video = videoRef.value
    if (!video) return
    if (video.paused) safePlay()
    else video.pause()
  }

  /** Whether `seconds` (episode time) is already buffered in the current stream. */
  function isBuffered(seconds: number): boolean {
    const video = videoRef.value
    if (!video) return false
    const local = seconds - offset.value
    for (let i = 0; i < video.buffered.length; i++) {
      if (local >= video.buffered.start(i) && local <= video.buffered.end(i)) return true
    }
    return false
  }

  /** Jump to an absolute position on the episode's timeline. */
  function seekTo(seconds: number) {
    const video = videoRef.value
    if (!video) return
    const max = duration.value > 0 ? duration.value - 0.5 : Number.MAX_SAFE_INTEGER
    const target = Math.min(Math.max(0, seconds), Math.max(0, max))

    if (isSeekable.value) {
      video.currentTime = target
      currentTime.value = target
      return
    }

    // Short hops inside the buffer don't need a new stream.
    if (!isScrubbing && isBuffered(target)) {
      video.currentTime = target - offset.value
      currentTime.value = target
      return
    }

    // Anything else restarts the stream; wait for the scrubber to settle.
    const resumePlayback = isScrubbing ? pendingAutoplay : hasStarted.value && !video.paused
    isScrubbing = true
    pendingAutoplay = resumePlayback
    currentTime.value = target
    if (seekTimer) clearTimeout(seekTimer)
    seekTimer = setTimeout(async () => {
      await load(baseUrl, { seekable: false, position: target, autoplay: resumePlayback })
      isScrubbing = false
    }, SEEK_DEBOUNCE_MS)
  }

  /** Skip the playhead by `seconds` (negative seeks backward). */
  function seekRelative(seconds: number) {
    seekTo(currentTime.value + seconds)
  }

  /** Jump the playhead to an absolute time from a slider input event. */
  function onSeekInput(event: Event) {
    seekTo(Number((event.target as HTMLInputElement).value))
  }

  /** Set the playback volume (0..1). */
  function setVolume(value: number) {
    const clamped = Math.min(1, Math.max(0, value))
    volume.value = clamped
    if (videoRef.value) videoRef.value.volume = clamped
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped))
    } catch {
      /* private mode → ignore */
    }
  }

  /** Mute, or restore the volume that was set before muting. */
  function toggleMute() {
    if (volume.value > 0) {
      volumeBeforeMute = volume.value
      setVolume(0)
    } else {
      setVolume(volumeBeforeMute || 1)
    }
  }

  /** Set the playback rate. */
  function setSpeed(value: number) {
    playbackSpeed.value = value
    if (videoRef.value) videoRef.value.playbackRate = value
  }

  /** Toggle fullscreen on the player wrapper. */
  function toggleFullscreen() {
    const wrapper = document.querySelector(wrapperSelector) as HTMLElement | null
    if (!document.fullscreenElement) wrapper?.requestFullscreen()
    else document.exitFullscreen()
  }

  /** Pop the video out into a floating picture-in-picture window. */
  async function togglePictureInPicture() {
    const video = videoRef.value
    if (!video || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch {
      /* refused by the browser (e.g. metadata not loaded yet) */
    }
  }

  /** Reveal controls when the user moves the cursor over the player. */
  function revealControls() {
    if (!hasStarted.value) return
    scheduleHideControls()
  }

  /** Flash the +5s/-5s indicator on a chosen side. */
  function flashSeekHint(side: 'left' | 'right') {
    seekHint.value = side
    if (seekHintTimer) clearTimeout(seekHintTimer)
    seekHintTimer = setTimeout(() => {
      seekHint.value = null
    }, SEEK_HINT_DELAY_MS)
  }

  /**
   * Handle a click on the player surface.
   * A second click on the same side within `DOUBLE_TAP_WINDOW_MS`
   * triggers a 5-second seek instead of a play/pause.
   */
  function onTap(event: MouseEvent) {
    if (!hasStarted.value) return
    const target = event.currentTarget as HTMLElement
    const side = event.clientX - target.getBoundingClientRect().left < target.clientWidth / 2
      ? 'left'
      : 'right'
    const now = Date.now()
    if (now - lastTapTime < DOUBLE_TAP_WINDOW_MS && lastTapSide === side) {
      seekRelative(side === 'left' ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS)
      flashSeekHint(side)
      lastTapTime = 0
    } else {
      lastTapTime = now
      lastTapSide = side
    }
  }

  /** Sync `currentTime` from the underlying element. */
  function onTimeUpdate() {
    if (!videoRef.value || isScrubbing) return
    currentTime.value = offset.value + videoRef.value.currentTime
  }

  /** A new stream is ready: restore position, volume, speed and playback. */
  function onLoadedMetadata() {
    const video = videoRef.value
    if (!video) return

    video.volume = volume.value
    video.playbackRate = playbackSpeed.value
    elementDuration.value = Number.isFinite(video.duration) ? offset.value + video.duration : 0

    if (pendingSeek !== null) {
      video.currentTime = pendingSeek
      pendingSeek = null
    }
    if (pendingAutoplay) {
      pendingAutoplay = false
      hasStarted.value = true
      safePlay()
    }
  }

  /** Keep `isPlaying` in sync with native play/pause events. */
  function onVideoStateChange() {
    if (!videoRef.value) return
    isPlaying.value = !videoRef.value.paused
    if (isPlaying.value) scheduleHideControls()
    else showControls.value = true
  }

  function onWaiting() {
    isBuffering.value = true
  }

  function onPlaying() {
    isBuffering.value = false
  }

  function syncFullscreenState() {
    isFullscreen.value = !!document.fullscreenElement
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncFullscreenState)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState)
    if (hideControlsTimer) clearTimeout(hideControlsTimer)
    if (seekHintTimer) clearTimeout(seekHintTimer)
    if (seekTimer) clearTimeout(seekTimer)
    loadToken++
  })

  return {
    // refs & state
    videoRef,
    activeSrc,
    offset,
    isSeekable,
    hasStarted,
    isPlaying,
    isBuffering,
    showControls,
    volume,
    playbackSpeed,
    isFullscreen,
    currentTime,
    duration,
    seekHint,
    availableSpeeds: AVAILABLE_SPEEDS,

    // actions
    load,
    startVideo,
    togglePlay,
    seekTo,
    seekRelative,
    onSeekInput,
    setVolume,
    toggleMute,
    setSpeed,
    toggleFullscreen,
    togglePictureInPicture,
    revealControls,
    onTap,
    onTimeUpdate,
    onLoadedMetadata,
    onVideoStateChange,
    onWaiting,
    onPlaying,
  }
}
