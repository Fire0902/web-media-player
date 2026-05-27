<script setup lang="ts">
import type { Episode } from '@/types/media'
import { stripFileExtension } from '@/utils/format'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import PlayerControls from './PlayerControls.vue'
import SeekHint from './SeekHint.vue'
import { PAUSE_PATH, PLAY_PATH } from './icons'

/**
 * High-level `<video>` wrapper. Reads from a media URL and offers an
 * overlay with start-screen, contextual controls, seek hints and speed menu.
 *
 * The component itself is mostly composition: real behavior lives in
 * `useVideoPlayer` (state + actions) and `PlayerControls` (transport bar).
 */
defineProps<{
  src: string
  title: string
  seasonName: string
  animeName: string
  nextEpisode: Episode | null
  prevEpisode: Episode | null
}>()

const emit = defineEmits<{
  (event: 'play-episode', ep: Episode): void
  (event: 'go-anime'): void
  (event: 'go-season'): void
}>()

const {
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
  availableSpeeds,
  startVideo,
  togglePlay,
  onSeekInput,
  setVolume,
  setSpeed,
  toggleFullscreen,
  revealControls,
  onTap,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoStateChange,
} = useVideoPlayer('.vp-wrapper')
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
      :src="src"
      :key="src"
      @play="onVideoStateChange"
      @pause="onVideoStateChange"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    />

    <transition name="fade">
      <div v-if="!hasStarted" class="vp-start-screen">
        <button class="vp-start-btn" @click.stop="startVideo">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path :d="PLAY_PATH" fill="white" />
          </svg>
        </button>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="hasStarted && showControls" class="vp-info">
        <p class="vp-title">{{ stripFileExtension(title) }}</p>
        <p class="vp-season vp-link" @click.stop="emit('go-season')">{{ seasonName }}</p>
        <p class="vp-anime vp-link" @click.stop="emit('go-anime')">{{ animeName }}</p>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="hasStarted && showControls" class="vp-center-play">
        <button class="vp-center-btn" @click.stop="togglePlay">
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
      <PlayerControls
        v-if="hasStarted && showControls"
        :is-playing="isPlaying"
        :current-time="currentTime"
        :duration="duration"
        :volume="volume"
        :speed="playbackSpeed"
        :speeds="availableSpeeds"
        :speed-menu-open="showSpeedMenu"
        :is-fullscreen="isFullscreen"
        :prev-episode="prevEpisode"
        :next-episode="nextEpisode"
        @toggle-play="togglePlay"
        @seek="onSeekInput"
        @set-volume="setVolume"
        @select-speed="setSpeed"
        @update:speed-menu-open="showSpeedMenu = $event"
        @toggle-fullscreen="toggleFullscreen"
        @play-episode="emit('play-episode', $event)"
      />
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

.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
