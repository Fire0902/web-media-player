<script setup lang="ts" generic="Q extends string">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import type { Chapter, Episode } from '@/types/media'
import api from '@/utils/api'
import { episodeTitle, stripFileExtension } from '@/utils/format'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { useSubtitles } from '@/composables/useSubtitles'
import PlayerControls from './PlayerControls.vue'
import SeekHint from './SeekHint.vue'
import SubtitleMenu from './SubtitleMenu.vue'
import OptionMenu from './OptionMenu.vue'
import { PAUSE_PATH, PLAY_PATH } from './icons'

/**
 * High-level `<video>` wrapper. Reads from a media URL and offers an
 * overlay with start-screen, contextual controls, seek hints and menus
 * (subtitles, audio track, quality, speed).
 *
 * The component itself is mostly composition: real behavior lives in
 * `useVideoPlayer` (state + actions), `useSubtitles` (track loading +
 * JASSUB) and `PlayerControls` (transport bar).
 *
 * It stays mounted when the episode changes so fullscreen survives
 * from one episode to the next.
 */
const props = defineProps<{
  episodeId: string
  /** Stream URL without any seek offset. */
  src: string
  /** Direct play (range requests) vs converted, sequential stream. */
  seekable: boolean
  /** Converted stream that copies the video: starts land on keyframes. */
  snapToKeyframe: boolean
  /** Runtime known by the server, in seconds. */
  knownDuration: number | null
  /** Resume position in seconds. */
  startAt: number
  /** Start without waiting for a click (chained episodes). */
  autoplay: boolean
  /** Chain to the next episode when this one ends. */
  autoplayNext: boolean
  title: string
  seasonName: string
  animeName: string
  /** Short label of how the stream is delivered ("Lecture directe"…). */
  methodLabel: string
  chapters: Chapter[]
  audioOptions: { value: number; label: string; hint?: string }[]
  selectedAudio: number
  qualityOptions: { value: Q; label: string; hint?: string }[]
  selectedQuality: Q
  nextEpisode: Episode | null
  prevEpisode: Episode | null
}>()

const emit = defineEmits<{
  (event: 'play-episode', ep: Episode): void
  (event: 'go-anime'): void
  (event: 'go-season'): void
  (event: 'progress', payload: { position: number; duration: number; paused: boolean }): void
  (event: 'ended'): void
  (event: 'playback-error'): void
  (event: 'select-audio', index: number): void
  (event: 'select-quality', quality: Q): void
}>()

/** Seconds left on screen before the next episode starts by itself. */
const NEXT_EPISODE_COUNTDOWN = 8
const KEYBOARD_SEEK_SECONDS = 10
const VOLUME_STEP = 0.05

type MenuName = 'subs' | 'audio' | 'quality' | 'speed'
/** Only one drop-up menu is open at a time. */
const openMenu = ref<MenuName | null>(null)

function setMenu(name: MenuName, open: boolean) {
  openMenu.value = open ? name : null
}

/** Ask the server where a stream-copied video really starts. */
async function resolveStart(seconds: number): Promise<number> {
  if (!props.snapToKeyframe) return seconds
  try {
    const { data } = await api.get<{ time: number }>(
      `/episodes/${props.episodeId}/keyframe?t=${seconds.toFixed(3)}`,
    )
    return data.time
  } catch {
    return seconds
  }
}

const {
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
  availableSpeeds,
  load,
  startVideo,
  togglePlay,
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
} = useVideoPlayer({
  wrapperSelector: '.vp-wrapper',
  knownDuration: toRef(props, 'knownDuration'),
  resolveStart,
})

const {
  tracks: subtitleTracks,
  selectedTrackId,
  isAssActive,
  nativeTrackUrl,
  selectTrack,
} = useSubtitles(videoRef, toRef(props, 'episodeId'), offset)

const pipSupported = computed(() => document.pictureInPictureEnabled)
const audioLabel = computed(
  () => props.audioOptions.find((option) => option.value === props.selectedAudio)?.label ?? 'Audio',
)
const qualityLabel = computed(
  () =>
    props.qualityOptions.find((option) => option.value === props.selectedQuality)?.label ??
    'Qualité',
)

// ── Next episode countdown ─────────────────────────────────────────────

const nextCountdown = ref<number | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function cancelCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
  nextCountdown.value = null
}

function playNextNow() {
  const next = props.nextEpisode
  cancelCountdown()
  if (next) emit('play-episode', next)
}

function onEnded() {
  emitProgress()
  emit('ended')
  if (!props.nextEpisode || !props.autoplayNext) return

  nextCountdown.value = NEXT_EPISODE_COUNTDOWN
  countdownTimer = setInterval(() => {
    if (nextCountdown.value === null) return
    nextCountdown.value -= 1
    if (nextCountdown.value <= 0) playNextNow()
  }, 1000)
}

// ── Progress reporting ─────────────────────────────────────────────────

function emitProgress() {
  if (!hasStarted.value) return
  emit('progress', {
    position: currentTime.value,
    duration: duration.value,
    paused: !isPlaying.value,
  })
}

function handleTimeUpdate() {
  onTimeUpdate()
  emitProgress()
}

function handleStateChange() {
  onVideoStateChange()
  emitProgress()
}

function onVideoError() {
  // An empty `src` (before the first load) also raises an error event.
  if (activeSrc.value) emit('playback-error')
}

// ── Stream changes ─────────────────────────────────────────────────────

onMounted(() => {
  load(props.src, { seekable: props.seekable, position: props.startAt, autoplay: props.autoplay })
})

watch(
  () => [props.episodeId, props.src, props.seekable] as const,
  ([episodeId], [previousEpisodeId]) => {
    cancelCountdown()
    if (episodeId !== previousEpisodeId) {
      // New episode: start where the user left it, keep the session rolling.
      load(props.src, {
        seekable: props.seekable,
        position: props.startAt,
        autoplay: hasStarted.value || props.autoplay,
      })
    } else {
      // Same episode, different stream (audio track, quality): keep the position.
      load(props.src, {
        seekable: props.seekable,
        position: currentTime.value,
        autoplay: isPlaying.value,
      })
    }
  },
)

// ── Keyboard shortcuts ─────────────────────────────────────────────────

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
    // Let the scrubber and volume sliders keep their own arrow keys.
    if (!(target instanceof HTMLInputElement && target.type === 'range')) return
    if (event.key.startsWith('Arrow')) return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  // Space on a focused button already clicks it.
  if (event.key === ' ' && target?.tagName === 'BUTTON') return

  switch (event.key) {
    case ' ':
    case 'k':
    case 'K':
      togglePlay()
      break
    case 'ArrowLeft':
      seekRelative(-KEYBOARD_SEEK_SECONDS)
      break
    case 'ArrowRight':
      seekRelative(KEYBOARD_SEEK_SECONDS)
      break
    case 'ArrowUp':
      setVolume(volume.value + VOLUME_STEP)
      break
    case 'ArrowDown':
      setVolume(volume.value - VOLUME_STEP)
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
    case 'm':
    case 'M':
      toggleMute()
      break
    case 'n':
    case 'N':
      if (props.nextEpisode) emit('play-episode', props.nextEpisode)
      break
    case 'p':
    case 'P':
      if (props.prevEpisode) emit('play-episode', props.prevEpisode)
      break
    default:
      return
  }
  event.preventDefault()
  revealControls()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  cancelCountdown()
})
</script>

<template>
  <div
    class="vp-wrapper"
    :style="{ cursor: hasStarted && !showControls ? 'none' : 'default' }"
    @mousemove="revealControls"
    @click="onTap"
  >
    <video
      ref="videoRef"
      :src="activeSrc || undefined"
      :preload="isSeekable ? 'metadata' : 'none'"
      crossorigin="anonymous"
      playsinline
      @play="handleStateChange"
      @pause="handleStateChange"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @waiting="onWaiting"
      @playing="onPlaying"
      @canplay="onPlaying"
      @ended="onEnded"
      @error="onVideoError"
    >
      <track
        v-if="!isAssActive && nativeTrackUrl"
        :key="nativeTrackUrl"
        :src="nativeTrackUrl"
        kind="subtitles"
        default
      />
    </video>

    <transition name="fade">
      <div v-if="!hasStarted" class="vp-start-screen">
        <button class="vp-start-btn" aria-label="Lecture" @click.stop="startVideo">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path :d="PLAY_PATH" fill="white" />
          </svg>
        </button>
      </div>
    </transition>

    <div v-if="hasStarted && isBuffering && nextCountdown === null" class="vp-buffering">
      <div class="vp-spinner" />
    </div>

    <transition name="fade">
      <div v-if="hasStarted && showControls" class="vp-info">
        <p class="vp-title">{{ stripFileExtension(title) }}</p>
        <p class="vp-season vp-link" @click.stop="emit('go-season')">{{ seasonName }}</p>
        <p class="vp-anime vp-link" @click.stop="emit('go-anime')">{{ animeName }}</p>
      </div>
    </transition>

    <transition name="fade">
      <span v-if="hasStarted && showControls && methodLabel" class="vp-method">
        {{ methodLabel }}
      </span>
    </transition>

    <transition name="fade">
      <div v-if="hasStarted && showControls && nextCountdown === null" class="vp-center-play">
        <button
          class="vp-center-btn"
          :aria-label="isPlaying ? 'Pause' : 'Lecture'"
          @click.stop="togglePlay"
        >
          <svg v-if="!isPlaying" viewBox="0 0 24 24" width="32" height="32">
            <path :d="PLAY_PATH" fill="white" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="32" height="32">
            <path :d="PAUSE_PATH" fill="white" />
          </svg>
        </button>
      </div>
    </transition>

    <SeekHint :side="seekHint" />

    <transition name="fade">
      <div v-if="nextCountdown !== null && nextEpisode" class="vp-next" @click.stop>
        <p class="vp-next-label">Épisode suivant dans {{ nextCountdown }} s</p>
        <p class="vp-next-title">{{ episodeTitle(nextEpisode) }}</p>
        <div class="vp-next-actions">
          <button class="vp-next-btn primary" @click.stop="playNextNow">Lire maintenant</button>
          <button class="vp-next-btn" @click.stop="cancelCountdown">Annuler</button>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <PlayerControls
        v-if="hasStarted && (showControls || openMenu !== null)"
        :is-playing="isPlaying"
        :current-time="currentTime"
        :duration="duration"
        :chapters="chapters"
        :volume="volume"
        :speed="playbackSpeed"
        :speeds="availableSpeeds"
        :speed-menu-open="openMenu === 'speed'"
        :is-fullscreen="isFullscreen"
        :pip-supported="pipSupported"
        :prev-episode="prevEpisode"
        :next-episode="nextEpisode"
        @toggle-play="togglePlay"
        @seek="onSeekInput"
        @set-volume="setVolume"
        @toggle-mute="toggleMute"
        @select-speed="setSpeed($event); setMenu('speed', false)"
        @update:speed-menu-open="setMenu('speed', $event)"
        @toggle-fullscreen="toggleFullscreen"
        @toggle-pip="togglePictureInPicture"
        @play-episode="emit('play-episode', $event)"
      >
        <template #extras>
          <SubtitleMenu
            :open="openMenu === 'subs'"
            :tracks="subtitleTracks"
            :selected-track-id="selectedTrackId"
            @update:open="setMenu('subs', $event)"
            @select="selectTrack($event); setMenu('subs', false)"
          />
          <OptionMenu
            v-if="audioOptions.length > 1"
            :open="openMenu === 'audio'"
            :label="audioLabel"
            title="Piste audio"
            :options="audioOptions"
            :selected="selectedAudio"
            @update:open="setMenu('audio', $event)"
            @select="emit('select-audio', $event); setMenu('audio', false)"
          />
          <OptionMenu
            :open="openMenu === 'quality'"
            :label="qualityLabel"
            title="Qualité"
            :options="qualityOptions"
            :selected="selectedQuality"
            @update:open="setMenu('quality', $event)"
            @select="emit('select-quality', $event); setMenu('quality', false)"
          />
        </template>
      </PlayerControls>
    </transition>
  </div>
</template>

<style scoped>
.vp-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
  user-select: none;
}
.vp-wrapper:fullscreen {
  border-radius: 0;
}
video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.vp-link {
  cursor: pointer;
  pointer-events: all;
}
.vp-link:hover {
  text-decoration: underline;
  color: rgba(255, 255, 255, .95);
}

.vp-start-screen {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.vp-start-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .85);
  background: rgba(255, 255, 255, .15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--t-base), transform var(--t-fast);
}
.vp-start-btn:hover {
  background: rgba(255, 255, 255, .25);
  transform: scale(1.08);
}

.vp-buffering {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.vp-spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, .2);
  border-top-color: #fff;
  animation: vp-spin .8s linear infinite;
}
@keyframes vp-spin { to { transform: rotate(360deg); } }

.vp-info {
  position: absolute;
  top: 1rem;
  left: 1rem;
  pointer-events: none;
}
.vp-title {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  margin: 0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .7);
}
.vp-season {
  font-size: 12px;
  color: rgba(255, 255, 255, .7);
  margin: 2px 0 0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .7);
}
.vp-anime {
  font-size: 11px;
  color: rgba(255, 255, 255, .45);
  margin: 1px 0 0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .7);
}

.vp-method {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .8);
  background: rgba(0, 0, 0, .5);
  border: 1px solid rgba(255, 255, 255, .15);
  border-radius: 100px;
  padding: 3px 10px;
  pointer-events: none;
}

.vp-center-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.vp-center-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: .85;
  transition: opacity var(--t-fast), transform var(--t-fast);
}
.vp-center-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.vp-next {
  position: absolute;
  right: 1.25rem;
  bottom: 5rem;
  max-width: min(320px, 70%);
  background: rgba(18, 18, 18, .92);
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: var(--r-md);
  padding: 14px 16px;
}
.vp-next-label {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .55);
}
.vp-next-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  overflow-wrap: anywhere;
}
.vp-next-actions {
  display: flex;
  gap: 8px;
}
.vp-next-btn {
  border: 1px solid rgba(255, 255, 255, .25);
  background: transparent;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 100px;
  cursor: pointer;
}
.vp-next-btn:hover { background: rgba(255, 255, 255, .12); }
.vp-next-btn.primary {
  background: var(--c-accent);
  border-color: var(--c-accent);
}
.vp-next-btn.primary:hover { filter: brightness(1.1); }

.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
