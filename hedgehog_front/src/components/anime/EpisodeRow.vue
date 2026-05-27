<script setup lang="ts">
import type { Episode, NumberingMode } from '@/types/media'
import {
  formatAirDate,
  formatEpisodeNumber,
  formatFileSize,
  stripFileExtension,
} from '@/utils/format'
import IconPlay from '@/components/ui/IconPlay.vue'
import { API_BASE_URL } from '@/config'

const BACKEND_BASE_URL = API_BASE_URL

/**
 * Single clickable row inside a season's episode list.
 * Renders thumbnail, title, badges and metadata. Clicking emits `play`.
 */
const props = defineProps<{
  episode: Episode
  numberingMode: NumberingMode
}>()

defineEmits<{ (event: 'play', episode: Episode): void }>()

/** Display title — falls back to the bare filename without extension. */
function displayTitle(episode: Episode): string {
  return episode.title ?? stripFileExtension(episode.name)
}
</script>

<template>
  <div
    class="episode-row"
    :class="{ filler: episode.filler, recap: episode.recap }"
    @click="$emit('play', episode)"
  >
    <div class="ep-num">{{ formatEpisodeNumber(episode, numberingMode) }}</div>

    <div class="ep-thumb">
      <img
        v-if="episode.thumbnailPath"
        :src="`${BACKEND_BASE_URL}${episode.thumbnailPath}`"
        :alt="`Aperçu ${displayTitle(episode)}`"
        loading="lazy"
      />
      <div v-else class="thumb-placeholder">
        <div class="thumb-spinner" />
      </div>
    </div>

    <div class="ep-info">
      <p class="ep-title">{{ displayTitle(episode) }}</p>
      <p v-if="episode.airedAt" class="ep-sub">{{ formatAirDate(episode.airedAt, true) }}</p>
    </div>

    <div class="ep-badges">
      <span v-if="episode.filler" class="badge filler-badge">Filler</span>
      <span v-if="episode.recap" class="badge recap-badge">Récap</span>
    </div>

    <div class="ep-size">{{ formatFileSize(episode.size) }}</div>

    <div class="ep-play"><IconPlay :size="18" /></div>
  </div>
</template>

<style scoped>
.episode-row {
  display: grid;
  grid-template-columns: 44px 112px 1fr auto auto 32px;
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
.ep-play {
  opacity: 0;
  transition: opacity var(--t-fast);
  color: var(--c-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 700px) {
  .episode-row { grid-template-columns: 36px 1fr auto 24px; }
  .ep-thumb,
  .ep-size { display: none; }
}
</style>
