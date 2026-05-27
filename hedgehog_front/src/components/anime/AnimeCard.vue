<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Anime } from '@/types/media'
import StatusPill from '@/components/ui/StatusPill.vue'

/**
 * Library card representing a single anime.
 * Clicking it navigates to the anime detail route.
 */
const props = defineProps<{ anime: Anime }>()
const router = useRouter()

/** Sum of every episode across every season. */
const totalEpisodes = computed(() =>
  props.anime.seasons.reduce((sum, season) => sum + season.episodes.length, 0),
)

const seasonCount = computed(() => props.anime.seasons.length)

function openDetail() {
  router.push({ name: 'anime', params: { id: props.anime.id } })
}
</script>

<template>
  <div class="anime-card" @click="openDetail">
    <div class="anime-cover">
      <img v-if="anime.coverUrl" :src="anime.coverUrl" :alt="anime.name" />
      <div v-else class="anime-cover-placeholder">
        <span>{{ anime.name[0] }}</span>
      </div>
      <div class="cover-gradient" />
      <StatusPill v-if="anime.status" :status="anime.status" size="sm" class="status-floating" />
    </div>

    <div class="anime-info">
      <p class="anime-name">{{ anime.name }}</p>
      <div class="anime-meta">
        <span>{{ seasonCount }} saison{{ seasonCount > 1 ? 's' : '' }}</span>
        <span>·</span>
        <span>{{ totalEpisodes }} ép.</span>
      </div>
      <div v-if="anime.genres?.length" class="anime-genres">
        <span v-for="genre in anime.genres.slice(0, 3)" :key="genre" class="genre-tag">
          {{ genre }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anime-card {
  cursor: pointer;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: transform var(--t-base), border-color var(--t-base), box-shadow var(--t-base);
  display: flex;
  flex-direction: column;
}
.anime-card:hover {
  transform: translateY(-4px);
  border-color: var(--c-border-strong);
  box-shadow: 0 16px 40px rgba(0, 0, 0, .4);
}

.anime-cover {
  position: relative;
  aspect-ratio: 2/3;
  overflow: hidden;
  background: var(--c-surface-2);
}
.anime-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--t-base);
}
.anime-card:hover .anime-cover img { transform: scale(1.04); }

.cover-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0, 0, 0, .35));
  pointer-events: none;
}

.anime-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 56px;
  color: var(--c-muted);
}

.status-floating {
  position: absolute;
  top: 8px;
  right: 8px;
}

.anime-info {
  padding: 12px 14px 14px;
}
.anime-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--c-text);
  margin: 0 0 4px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.anime-meta {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--c-muted);
  margin-bottom: 8px;
}
.anime-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.genre-tag {
  font-size: 10px;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 20px;
  background: transparent;
  color: var(--c-muted);
  border: 1px solid var(--c-border);
}
</style>
