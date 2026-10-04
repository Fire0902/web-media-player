<script setup lang="ts">
import { computed } from 'vue'
import type { Episode, NumberingMode, Season } from '@/types/media'
import { useProgressStore } from '@/utils/progressStore'
import StatusPill from '@/components/ui/StatusPill.vue'
import IconChevron from '@/components/ui/IconChevron.vue'
import EpisodeRow from './EpisodeRow.vue'

/**
 * Collapsible block listing every episode of a single season.
 * Uses the native `<details>` element for built-in accessibility.
 */
const props = defineProps<{
  season: Season
  numberingMode: NumberingMode
}>()

defineEmits<{ (event: 'play', episode: Episode): void }>()

const progressStore = useProgressStore()

const watchedCount = computed(
  () => props.season.episodes.filter((episode) => progressStore.isWatched(episode.id)).length,
)
const allWatched = computed(
  () => props.season.episodes.length > 0 && watchedCount.value === props.season.episodes.length,
)

function toggleSeasonWatched() {
  progressStore.setSeasonWatched(props.season.id, !allWatched.value)
}
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
          <span class="ep-count">
            {{ watchedCount }}/{{ season.episodes.length }} vu{{ watchedCount > 1 ? 's' : '' }}
          </span>
          <button
            class="season-watched"
            :class="{ active: allWatched }"
            @click.prevent.stop="toggleSeasonWatched"
          >
            {{ allWatched ? 'Marquer non vue' : 'Marquer vue' }}
          </button>
        </div>
      </summary>

      <div class="episodes-list">
        <EpisodeRow
          v-for="episode in season.episodes"
          :key="episode.id"
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
  gap: 12px;
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
  min-width: 0;
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
  flex-shrink: 0;
}
.ep-count {
  font-size: 12px;
  color: var(--c-muted);
  white-space: nowrap;
}
.season-watched {
  background: transparent;
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 100px;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.season-watched:hover { color: var(--c-text); border-color: var(--c-muted); }
.season-watched.active { color: var(--c-airing); border-color: var(--c-airing); }

.episodes-list {
  border-top: 1px solid var(--c-border);
}

@media (max-width: 600px) {
  .season-header { flex-wrap: wrap; padding: 14px 12px; }
}
</style>
