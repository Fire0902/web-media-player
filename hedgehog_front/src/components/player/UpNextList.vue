<script setup lang="ts">
import type { Episode } from '@/types/media'
import { formatAirDate, formatFileSize, stripFileExtension } from '@/utils/format'

/**
 * Right-rail "À suivre" list of upcoming episodes in the same season.
 * Clicking a row asks the parent to switch the player to that episode.
 */
defineProps<{ episodes: Episode[] }>()

defineEmits<{ (event: 'select', episode: Episode): void }>()
</script>

<template>
  <aside class="up-next">
    <h3 class="up-next-title">À suivre</h3>
    <p v-if="episodes.length === 0" class="up-next-empty">Pas d'épisodes suivants.</p>

    <div
      v-for="episode in episodes"
      :key="episode.id"
      class="next-ep-card"
      @click="$emit('select', episode)"
    >
      <div class="next-ep-num">{{ episode.episodeNumber ?? '?' }}</div>
      <div class="next-ep-info">
        <p class="next-ep-title">{{ episode.title ?? stripFileExtension(episode.name) }}</p>
        <p class="next-ep-meta">
          <span v-if="episode.airedAt">{{ formatAirDate(episode.airedAt, true) }}</span>
          <span v-if="episode.filler" class="inline-tag tag-filler">Filler</span>
        </p>
      </div>
      <span class="next-ep-size">{{ formatFileSize(episode.size) }}</span>
    </div>
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
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  margin-bottom: 8px;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.next-ep-card:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-strong);
}
.next-ep-num {
  width: 28px;
  flex-shrink: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-muted);
}
.next-ep-info { flex: 1; min-width: 0; }
.next-ep-title {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  color: var(--c-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next-ep-meta {
  font-size: 11px;
  color: var(--c-muted);
  margin: 2px 0 0;
}
.next-ep-size {
  font-size: 11px;
  color: var(--c-muted);
  flex-shrink: 0;
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
.tag-filler { background: rgba(245, 166, 35, .15); color: var(--c-accent-2); }
</style>
