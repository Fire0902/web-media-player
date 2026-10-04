<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { EpisodeContext } from '@/types/media'
import { episodeTitle, formatDuration } from '@/utils/format'
import { useProgressStore } from '@/utils/progressStore'
import IconPlay from '@/components/ui/IconPlay.vue'
import { API_BASE_URL } from '@/config'

/**
 * Landscape card for a single episode, used in the home page rows
 * ("Reprendre", "À suivre", "Ajouts récents"). Clicking it starts
 * playback; the anime name links to the detail page.
 */
const props = defineProps<{ item: EpisodeContext }>()

const router = useRouter()
const progressStore = useProgressStore()

const ratio = computed(() => progressStore.ratioOf(props.item.episode))

/** "S2 · É5" style locator, skipping the season when there is only one. */
const locator = computed(() => {
  const { episode, season, anime } = props.item
  const number = episode.episodeNumber != null ? `Ép. ${episode.episodeNumber}` : ''
  if (anime.seasons.length <= 1) return number
  return [season.name, number].filter(Boolean).join(' · ')
})

const remaining = computed(() => {
  const { episode } = props.item
  const position = progressStore.positionOf(episode.id)
  if (!episode.duration || position <= 0) return formatDuration(episode.duration)
  return `${formatDuration(episode.duration - position)} restantes`
})

function play() {
  router.push({ name: 'player', params: { id: props.item.episode.id } })
}
</script>

<template>
  <article class="episode-card">
    <button class="card-thumb" :aria-label="`Lire ${episodeTitle(item.episode)}`" @click="play">
      <img
        v-if="item.episode.thumbnailPath"
        :src="`${API_BASE_URL}${item.episode.thumbnailPath}`"
        alt=""
        loading="lazy"
      />
      <img v-else-if="item.anime.coverUrl" :src="item.anime.coverUrl" alt="" loading="lazy" />
      <span class="card-play"><IconPlay :size="26" /></span>
      <span v-if="ratio > 0" class="card-progress">
        <span class="card-progress-fill" :style="{ width: `${ratio * 100}%` }" />
      </span>
    </button>

    <div class="card-body">
      <router-link :to="{ name: 'anime', params: { id: item.anime.id } }" class="card-anime">
        {{ item.anime.name }}
      </router-link>
      <p class="card-title">{{ episodeTitle(item.episode) }}</p>
      <p class="card-meta">
        <span v-if="locator">{{ locator }}</span>
        <span v-if="locator && remaining"> · </span>
        <span v-if="remaining">{{ remaining }}</span>
      </p>
    </div>
  </article>
</template>

<style scoped>
.episode-card {
  width: 260px;
  flex-shrink: 0;
  scroll-snap-align: start;
}
.card-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--c-surface-2);
  cursor: pointer;
  transition: border-color var(--t-base), transform var(--t-base);
}
.card-thumb:hover {
  border-color: var(--c-border-strong);
  transform: translateY(-3px);
}
.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.card-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, .35);
  opacity: 0;
  transition: opacity var(--t-fast);
}
.card-thumb:hover .card-play,
.card-thumb:focus-visible .card-play { opacity: 1; }

.card-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: rgba(255, 255, 255, .25);
}
.card-progress-fill {
  display: block;
  height: 100%;
  background: var(--c-accent);
}

.card-body { padding: 10px 2px 0; }
.card-anime {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-anime:hover { text-decoration: underline; }
.card-title {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--c-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--c-muted);
}

@media (max-width: 600px) {
  .episode-card { width: 210px; }
}
</style>
