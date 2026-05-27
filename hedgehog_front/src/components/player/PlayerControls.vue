<script setup lang="ts">
import type { Episode } from '@/types/media'
import ProgressBar from './ProgressBar.vue'
import VolumeControl from './VolumeControl.vue'
import SpeedMenu from './SpeedMenu.vue'
import {
  FULLSCREEN_ENTER_PATH,
  FULLSCREEN_EXIT_PATH,
  NEXT_PATH,
  PAUSE_PATH,
  PLAY_PATH,
  PREV_PATH,
} from './icons'

/**
 * Bottom controls overlay: progress bar + transport row.
 * All visible state is owned by the parent (via the `useVideoPlayer` composable).
 */
defineProps<{
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  speed: number
  speeds: number[]
  speedMenuOpen: boolean
  isFullscreen: boolean
  prevEpisode: Episode | null
  nextEpisode: Episode | null
}>()

const emit = defineEmits<{
  (event: 'toggle-play'): void
  (event: 'seek', payload: Event): void
  (event: 'set-volume', value: number): void
  (event: 'select-speed', value: number): void
  (event: 'update:speed-menu-open', open: boolean): void
  (event: 'toggle-fullscreen'): void
  (event: 'play-episode', episode: Episode): void
}>()

function playPrev(prev: Episode | null) {
  if (prev) emit('play-episode', prev)
}

function playNext(next: Episode | null) {
  if (next) emit('play-episode', next)
}
</script>

<template>
  <div class="controls-wrap">
    <ProgressBar
      :current-time="currentTime"
      :duration="duration"
      @seek="$emit('seek', $event)"
    />

    <div class="controls">
      <div class="controls-left">
        <button class="btn" :disabled="!prevEpisode" @click.stop="playPrev(prevEpisode)">
          <svg viewBox="0 0 24 24" width="22" height="22"><path :d="PREV_PATH" fill="white" /></svg>
        </button>
        <button class="btn btn-main" @click.stop="$emit('toggle-play')">
          <svg v-if="!isPlaying" viewBox="0 0 24 24" width="26" height="26">
            <path :d="PLAY_PATH" fill="white" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="26" height="26">
            <path :d="PAUSE_PATH" fill="white" />
          </svg>
        </button>
        <button class="btn" :disabled="!nextEpisode" @click.stop="playNext(nextEpisode)">
          <svg viewBox="0 0 24 24" width="22" height="22"><path :d="NEXT_PATH" fill="white" /></svg>
        </button>
      </div>

      <div class="controls-right">
        <VolumeControl :volume="volume" @update:volume="$emit('set-volume', $event)" />

        <SpeedMenu
          :open="speedMenuOpen"
          :current-speed="speed"
          :speeds="speeds"
          @update:open="$emit('update:speed-menu-open', $event)"
          @select="$emit('select-speed', $event)"
        />

        <button class="btn" @click.stop="$emit('toggle-fullscreen')">
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" width="20" height="20">
            <path :d="FULLSCREEN_ENTER_PATH" fill="white" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20">
            <path :d="FULLSCREEN_EXIT_PATH" fill="white" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-wrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, .65));
  padding: 0 .75rem .6rem;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.controls-left, .controls-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast);
}
.btn:hover { background: rgba(255, 255, 255, .15); }
.btn:disabled { opacity: .3; cursor: default; }
.btn-main { padding: 6px; }
</style>
