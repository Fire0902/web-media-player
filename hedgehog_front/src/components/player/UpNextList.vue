<script setup lang="ts">
import type { Episode } from '@/types/media'
import { episodeTitle, formatDuration } from '@/utils/format'
import { useProgressStore } from '@/utils/progressStore'
import { API_BASE_URL } from '@/config'

/**
 * Right-rail "À suivre" list of upcoming episodes in the same season.
 * Clicking a row asks the parent to switch the player to that episode.
 */
defineProps<{ episodes: Episode[] }>()

defineEmits<{ (event: 'select', episode: Episode): void }>()

const progressStore = useProgressStore()
</script>

<template>
  <aside class="up-next">
    <h3 class="up-next-title">À suivre</h3>
    <p v-if="episodes.length === 0" class="up-next-empty">Pas d'épisodes suivants.</p>

    <button
      v-for="episode in episodes"
      :key="episode.id"
      class="next-ep-card"
      :class="{ watched: progressStore.isWatched(episode.id) }"
      @click="$emit('select', episode)"
    >
      <div class="next-ep-thumb">
        <img
          v-if="episode.thumbnailPath"
          :src="`${API_BASE_URL}${episode.thumbnailPath}`"
          alt=""
          loading="lazy"
        />
        <span class="next-ep-num">{{ episode.episodeNumber ?? '?' }}</span>
        <div
          v-if="progressStore.ratioOf(episode) > 0"
          class="thumb-progress"
          :style="{ width: `${progressStore.ratioOf(episode) * 100}%` }"
        />
      </div>
      <div class="next-ep-info">
        <p class="next-ep-title">{{ episodeTitle(episode) }}</p>
        <p class="next-ep-meta">
          <span v-if="episode.duration">{{ formatDuration(episode.duration) }}</span>
          <span v-if="progressStore.isWatched(episode.id)" class="inline-tag tag-watched">Vu</span>
          <span v-if="episode.filler" class="inline-tag tag-filler">Filler</span>
        </p>
      </div>
    </button>
  </aside>
</template>

<style scoped>
.up-next-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 16px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--c-muted);
  margin: 0 0 12px;
}
.up-next-empty {
  color: var(--c-muted);
  font-size: 13px;
}
.next-ep-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  margin-bottom: 8px;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.next-ep-card:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-strong);
}
.next-ep-card.watched .next-ep-thumb img { opacity: .5; }

.next-ep-thumb {
  position: relative;
  width: 96px;
  aspect-ratio: 16/9;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--c-surface-2);
}
.next-ep-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.next-ep-num {
  position: absolute;
  left: 4px;
  bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, .65);
  padding: 1px 6px;
  border-radius: 4px;
}
.thumb-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: var(--c-accent);
}
.next-ep-info { flex: 1; min-width: 0; }
.next-ep-title {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  color: var(--c-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.next-ep-meta {
  font-size: 11px;
  color: var(--c-muted);
  margin: 3px 0 0;
}
.inline-tag {
  display: inline-block;
  margin-left: 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 4px;
  vertical-align: middle;
}
.inline-tag:first-child { margin-left: 0; }
.tag-filler { background: rgba(245, 166, 35, .15); color: var(--c-accent-2); }
.tag-watched { background: rgba(48, 209, 88, .15); color: var(--c-airing); }
</style>
