import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Encapsulates all imperative `<video>` interactions used by the player.
 *
 * The composable returns reactive state (play status, time, volume, etc.)
 * and a set of imperative actions. The host component must bind the
 * returned `videoRef` to its `<video>` element and forward the relevant
 * media events (timeupdate, loadedmetadata, play, pause).
 *
 * Two timers are managed internally:
 *   - `hideControlsTimer` auto-hides the overlay during playback;
 *   - `seekHintTimer` clears the +/- 5s hint after a short delay.
 */
export function useVideoPlayer(wrapperSelector = '.vp-wrapper') {
  const videoRef: Ref<HTMLVideoElement | null> = ref(null)

  const hasStarted = ref(false)
  const isPlaying = ref(false)
  const showControls = ref(true)
  const volume = ref(1)
  const playbackSpeed = ref(1)
  const isFullscreen = ref(false)
  const showSpeedMenu = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const seekHint = ref<'left' | 'right' | null>(null)

  const AVAILABLE_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const HIDE_DELAY_MS = 3000
  const SEEK_HINT_DELAY_MS = 500
  const DOUBLE_TAP_WINDOW_MS = 300
  const SEEK_STEP_SECONDS = 5

  let hideControlsTimer: ReturnType<typeof setTimeout> | null = null
  let seekHintTimer: ReturnType<typeof setTimeout> | null = null
  let lastTapTime = 0
  let lastTapSide: 'left' | 'right' | '' = ''

  /** Show controls now, then hide them again after `HIDE_DELAY_MS` if still playing. */
  function scheduleHideControls() {
    if (hideControlsTimer) clearTimeout(hideControlsTimer)
    showControls.value = true
    hideControlsTimer = setTimeout(() => {
      if (isPlaying.value) showControls.value = false
    }, HIDE_DELAY_MS)
  }

  /** Start playback for the first time and flip out of the start-screen state. */
  function startVideo() {
    hasStarted.value = true
    videoRef.value?.play()
    isPlaying.value = true
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
    video.paused ? video.play() : video.pause()
    isPlaying.value = !video.paused
  }

  /** Skip the playhead by `seconds` (negative seeks backward). */
  function seekRelative(seconds: number) {
    if (videoRef.value) videoRef.value.currentTime += seconds
  }

  /** Jump the playhead to an absolute time from a slider input event. */
  function onSeekInput(event: Event) {
    const video = videoRef.value
    if (!video) return
    video.currentTime = Number((event.target as HTMLInputElement).value)
  }

  /** Set the playback volume (0..1). */
  function setVolume(value: number) {
    volume.value = value
    if (videoRef.value) videoRef.value.volume = value
  }

  /** Set the playback rate and close the speed menu. */
  function setSpeed(value: number) {
    playbackSpeed.value = value
    if (videoRef.value) videoRef.value.playbackRate = value
    showSpeedMenu.value = false
  }

  /** Toggle fullscreen on the player wrapper. */
  function toggleFullscreen() {
    const wrapper = document.querySelector(wrapperSelector) as HTMLElement | null
    if (!document.fullscreenElement) wrapper?.requestFullscreen()
    else document.exitFullscreen()
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
    if (videoRef.value) currentTime.value = videoRef.value.currentTime
  }

  /** Capture the total duration once metadata is available. */
  function onLoadedMetadata() {
    if (videoRef.value) duration.value = videoRef.value.duration
  }

  /** Keep `isPlaying` in sync with native play/pause events. */
  function onVideoStateChange() {
    if (videoRef.value) isPlaying.value = !videoRef.value.paused
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
  })

  return {
    // refs & state
    videoRef,
    hasStarted,
    isPlaying,
    showControls,
    volume,
    playbackSpeed,
    isFullscreen,
    showSpeedMenu,
    currentTime,
    duration,
    seekHint,
    availableSpeeds: AVAILABLE_SPEEDS,

    // actions
    startVideo,
    togglePlay,
    seekRelative,
    onSeekInput,
    setVolume,
    setSpeed,
    toggleFullscreen,
    revealControls,
    onTap,
    onTimeUpdate,
    onLoadedMetadata,
    onVideoStateChange,
  }
}
