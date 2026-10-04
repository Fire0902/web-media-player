<script setup lang="ts">
import { computed } from 'vue'
import type { Episode, NumberingMode } from '@/types/media'
import {
  episodeTitle,
  formatAirDate,
  formatDuration,
  formatEpisodeNumber,
  formatFileSize,
} from '@/utils/format'
import { useProgressStore } from '@/utils/progressStore'
import IconPlay from '@/components/ui/IconPlay.vue'
import { CHECK_PATH } from '@/components/player/icons'
import { API_BASE_URL } from '@/config'

const BACKEND_BASE_URL = API_BASE_URL

/**
 * Single clickable row inside a season's episode list.
 * Renders thumbnail, title, badges, watch state and metadata.
 * Clicking emits `play`; the check button toggles "watched".
 */
const props = defineProps<{
  episode: Episode
  numberingMode: NumberingMode
}>()

defineEmits<{ (event: 'play', episode: Episode): void }>()

const progressStore = useProgressStore()

const watched = computed(() => progressStore.isWatched(props.episode.id))
const ratio = computed(() => progressStore.ratioOf(props.episode))

const subline = computed(() =>
  [
    props.episode.airedAt ? formatAirDate(props.episode.airedAt, true) : '',
    formatDuration(props.episode.duration),
  ]
    .filter(Boolean)
    .join(' · '),
)

function toggleWatched() {
  progressStore.setEpisodeWatched(props.episode.id, !watched.value)
}
</script>

<template>
  <div
    class="episode-row"
    :class="{ filler: episode.filler, recap: episode.recap, watched }"
    @click="$emit('play', episode)"
  >
    <div class="ep-num">{{ formatEpisodeNumber(episode, numberingMode) }}</div>

    <div class="ep-thumb">
      <img
        v-if="episode.thumbnailPath"
        :src="`${BACKEND_BASE_URL}${episode.thumbnailPath}`"
        :alt="`Aperçu ${episodeTitle(episode)}`"
        loading="lazy"
      />
      <div v-else class="thumb-placeholder">
        <div class="thumb-spinner" />
      </div>
      <div v-if="ratio > 0" class="thumb-progress">
        <div class="thumb-progress-fill" :style="{ width: `${ratio * 100}%` }" />
      </div>
    </div>

    <div class="ep-info">
      <p class="ep-title">{{ episodeTitle(episode) }}</p>
      <p v-if="subline" class="ep-sub">{{ subline }}</p>
    </div>

    <div class="ep-badges">
      <span v-if="episode.filler" class="badge filler-badge">Filler</span>
      <span v-if="episode.recap" class="badge recap-badge">Récap</span>
    </div>

    <div class="ep-size">{{ formatFileSize(episode.size) }}</div>

    <button
      class="ep-watched"
      :class="{ active: watched }"
      :aria-pressed="watched"
      :title="watched ? 'Marquer comme non vu' : 'Marquer comme vu'"
      :aria-label="watched ? 'Marquer comme non vu' : 'Marquer comme vu'"
      @click.stop="toggleWatched"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path :d="CHECK_PATH" />
      </svg>
    </button>

    <div class="ep-play"><IconPlay :size="18" /></div>
  </div>
</template>

<style scoped>
.episode-row {
  display: grid;
  grid-template-columns: 44px 112px 1fr auto auto 30px 32px;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background var(--t-fast);
  border-bottom: 1px solid var(--c-border);
  position: relative;
}
.episode-row:last-child { border-bottom: none; }
.episode-row:hover { background: var(--c-surface-2); }
.episode-row:hover .ep-play { opacity: 1; }

.episode-row.filler { opacity: .6; }
.episode-row.filler::before,
.episode-row.recap::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
}
.episode-row.filler::before { background: var(--c-accent-2); }
.episode-row.recap::before { background: var(--c-muted); }

.episode-row.watched .ep-title { color: var(--c-muted); }
.episode-row.watched .ep-thumb img { opacity: .55; }

.ep-num {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18px;
  color: var(--c-muted);
  text-align: center;
  letter-spacing: .05em;
}

.ep-thumb {
  width: 112px;
  height: 63px;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  flex-shrink: 0;
  position: relative;
}
.ep-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .1);
  border-top-color: rgba(255, 255, 255, .35);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.thumb-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, .25);
}
.thumb-progress-fill {
  height: 100%;
  background: var(--c-accent);
}

.ep-info { min-width: 0; }
.ep-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text);
  margin: 0 0 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ep-sub {
  font-size: 11px;
  color: var(--c-muted);
  margin: 0;
}
.ep-badges { display: flex; gap: 4px; }
.badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}
.filler-badge { background: rgba(245, 166, 35, .15); color: var(--c-accent-2); }
.recap-badge  { background: rgba(255, 255, 255, .06); color: var(--c-muted); }

.ep-size {
  font-size: 11px;
  color: var(--c-muted);
  white-space: nowrap;
}

.ep-watched {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: .55;
  transition: opacity var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ep-watched:hover { opacity: 1; color: var(--c-text); }
.ep-watched.active {
  opacity: 1;
  color: var(--c-airing);
  border-color: var(--c-airing);
}

.ep-play {
  opacity: 0;
  transition: opacity var(--t-fast);
  color: var(--c-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 700px) {
  .episode-row { grid-template-columns: 36px 1fr auto 30px 24px; padding: 10px 12px; gap: 10px; }
  .ep-thumb,
  .ep-size { display: none; }
}
</style>
