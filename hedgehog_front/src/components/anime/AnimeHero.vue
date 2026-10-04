<script setup lang="ts">
import type { Anime } from '@/types/media'
import StatusPill from '@/components/ui/StatusPill.vue'
import MetaChip from '@/components/ui/MetaChip.vue'

/**
 * Header block of the anime detail page: poster, title, tags and synopsis.
 * Purely presentational; action buttons (play, favorite…) are injected
 * by the parent through the `actions` slot.
 */
defineProps<{ anime: Anime }>()
</script>

<template>
  <header class="hero-block">
    <div class="hero-poster">
      <img v-if="anime.coverUrl" :src="anime.coverUrl" :alt="anime.name" />
      <div v-else class="poster-placeholder">{{ anime.name[0] }}</div>
    </div>

    <div class="hero-info">
      <div class="hero-tags">
        <StatusPill :status="anime.status" />
        <MetaChip v-if="anime.totalEpisodes">{{ anime.totalEpisodes }} épisodes</MetaChip>
        <MetaChip v-if="anime.rating">{{ anime.rating }}</MetaChip>
      </div>

      <h1 class="hero-title heading-display">{{ anime.name }}</h1>

      <div v-if="anime.genres?.length" class="genres">
        <span v-for="genre in anime.genres" :key="genre" class="genre-pill">{{ genre }}</span>
      </div>

      <div v-if="anime.studios?.length" class="studios">
        <span class="label-sm">Studio</span>
        {{ anime.studios.join(' · ') }}
      </div>

      <div class="hero-actions">
        <slot name="actions" />
      </div>

      <p v-if="anime.synopsis" class="synopsis">{{ anime.synopsis }}</p>
    </div>
  </header>
</template>

<style scoped>
.hero-block {
  display: flex;
  gap: 40px;
  align-items: flex-start;
  margin-bottom: 64px;
}
.hero-poster {
  width: 200px;
  flex-shrink: 0;
  border-radius: var(--r-md);
  overflow: hidden;
  aspect-ratio: 2/3;
  background: var(--c-surface-2);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .6), 0 0 0 1px var(--c-border);
}
.hero-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 64px;
  color: var(--c-muted);
}
.hero-info { min-width: 0; }
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.hero-title {
  font-size: clamp(36px, 5vw, 60px);
  line-height: 1;
  margin: 0 0 18px;
  color: var(--c-text);
  overflow-wrap: anywhere;
}
.genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.genre-pill {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 100px;
  background: transparent;
  border: 1px solid var(--c-border);
  color: var(--c-muted);
}
.studios {
  font-size: 13px;
  color: var(--c-muted);
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.label-sm {
  font-size: 10px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--c-muted);
  opacity: .6;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.hero-actions:empty { display: none; }
.synopsis {
  font-size: 14px;
  line-height: 1.75;
  color: var(--c-muted);
  max-width: 600px;
  font-style: italic;
  font-weight: 300;
}

@media (max-width: 700px) {
  .hero-block { flex-direction: column; gap: 24px; }
  .hero-poster { width: 140px; }
}
</style>
