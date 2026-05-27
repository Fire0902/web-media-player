<script setup lang="ts">
import { computed } from 'vue'
import type { Anime, Episode } from '@/types/media'
import { formatAirDate, stripFileExtension } from '@/utils/format'
import CastingGrid from './CastingGrid.vue'

/**
 * Information panel below the video: title, badges, aired date,
 * studio and (if available) the voice-acting cast.
 */
const props = defineProps<{
  episode: Episode
  anime: Anime | null
}>()

const headline = computed(() =>
  props.episode.title ?? stripFileExtension(props.episode.name),
)

const showAbsoluteNumber = computed(() =>
  !!props.episode.episodeNumberAbsolute &&
  props.episode.episodeNumberAbsolute !== props.episode.episodeNumber,
)

/**
 * Pick the cast to display:
 *   1. episode-level voice actors when present;
 *   2. otherwise fall back to the anime's main cast, capped at 12 entries.
 */
const cast = computed(() => {
  if (props.episode.voiceActors?.length) {
    return { title: 'Casting (Seiyū)', actors: props.episode.voiceActors }
  }
  if (props.anime?.voiceActors?.length) {
    return { title: 'Casting principal (Seiyū)', actors: props.anime.voiceActors.slice(0, 12) }
  }
  return null
})
</script>

<template>
  <div class="episode-info">
    <div class="ep-header">
      <div>
        <h2 class="ep-title">
          {{ headline }}
          <span v-if="episode.filler" class="inline-tag tag-filler">Filler</span>
          <span v-if="episode.recap" class="inline-tag tag-recap">Récap</span>
        </h2>
        <p v-if="episode.titleJapanese" class="ep-title-jp">{{ episode.titleJapanese }}</p>
      </div>

      <div class="ep-numbers">
        <span v-if="episode.episodeNumber" class="ep-num-badge">
          Ép. {{ episode.episodeNumber }}
        </span>
        <span v-if="showAbsoluteNumber" class="ep-num-badge ep-num-abs">
          #{{ episode.episodeNumberAbsolute }}
        </span>
      </div>
    </div>

    <div class="ep-meta">
      <span v-if="episode.airedAt" class="ep-meta-item">
        {{ formatAirDate(episode.airedAt) }}
      </span>
      <span v-if="anime?.studios?.length" class="ep-meta-item">
        {{ anime.studios.join(', ') }}
      </span>
    </div>

    <CastingGrid
      v-if="cast"
      :title="cast.title"
      :voice-actors="cast.actors"
    />
  </div>
</template>

<style scoped>
.episode-info {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding: 1.25rem 1.5rem;
}
.ep-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.ep-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--c-text);
  margin: 0;
}
.ep-title-jp {
  font-size: 13px;
  color: var(--c-muted);
  margin: 2px 0 0;
}
.ep-numbers {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}
.ep-num-badge {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 20px;
  background: var(--c-surface-2);
  color: var(--c-text-soft);
  border: 1px solid var(--c-border);
}
.ep-num-abs { color: var(--c-muted); }
.ep-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 8px;
  border-top: 1px solid var(--c-border);
}
.ep-meta-item {
  font-size: 13px;
  color: var(--c-text-soft);
}
.inline-tag {
  display: inline-block;
  margin-left: 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
  vertical-align: middle;
}
.tag-filler { background: rgba(245, 166, 35, .15); color: var(--c-accent-2); }
.tag-recap  { background: rgba(255, 255, 255, .06); color: var(--c-muted); }
</style>
