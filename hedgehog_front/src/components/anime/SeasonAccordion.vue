<script setup lang="ts">
import type { Episode, NumberingMode, Season } from '@/types/media'
import StatusPill from '@/components/ui/StatusPill.vue'
import IconChevron from '@/components/ui/IconChevron.vue'
import EpisodeRow from './EpisodeRow.vue'

/**
 * Collapsible block listing every episode of a single season.
 * Uses the native `<details>` element for built-in accessibility.
 */
defineProps<{
  season: Season
  numberingMode: NumberingMode
}>()

defineEmits<{ (event: 'play', episode: Episode): void }>()
</script>

<template>
  <div class="season-block">
    <details open>
      <summary class="season-header">
        <div class="season-title-row">
          <IconChevron class="chevron" />
          <span class="season-name">{{ season.name }}</span>
        </div>

        <div class="season-meta">
          <StatusPill :status="season.status" size="sm" feminine-ended />
          <span class="ep-count">{{ season.episodes.length }} ep.</span>
        </div>
      </summary>

      <div class="episodes-list">
        <EpisodeRow
          v-for="episode in season.episodes"
          :key="episode.path"
          :episode="episode"
          :numbering-mode="numberingMode"
          @play="$emit('play', $event)"
        />
      </div>
    </details>
  </div>
</template>

<style scoped>
.season-block {
  margin-bottom: 12px;
  border-radius: var(--r-lg);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  overflow: hidden;
}
.season-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: background var(--t-fast);
}
.season-header::-webkit-details-marker { display: none; }
.season-header:hover { background: var(--c-surface-2); }

.season-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chevron {
  color: var(--c-muted);
  transition: transform var(--t-base);
  flex-shrink: 0;
}
details[open] .chevron { transform: rotate(0deg); }
details:not([open]) .chevron { transform: rotate(-90deg); }

.season-name {
  font-weight: 500;
  font-size: 15px;
  color: var(--c-text);
}
.season-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ep-count {
  font-size: 12px;
  color: var(--c-muted);
}
.episodes-list {
  border-top: 1px solid var(--c-border);
}
</style>
