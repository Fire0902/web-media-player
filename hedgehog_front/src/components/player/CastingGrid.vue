<script setup lang="ts">
import type { VoiceActor } from '@/types/media'

/**
 * Display the seiyū lineup for an episode/anime.
 * Renders nothing when no voice actors are provided.
 */
defineProps<{
  title: string
  voiceActors: VoiceActor[]
}>()
</script>

<template>
  <section v-if="voiceActors.length" class="casting-section">
    <h3 class="casting-title">{{ title }}</h3>
    <div class="casting-grid">
      <div v-for="actor in voiceActors" :key="actor.actorName" class="va-card">
        <div class="va-images">
          <img
            v-if="actor.characterImage"
            :src="actor.characterImage"
            class="va-img"
            :alt="actor.characterName"
          />
          <div v-else class="va-img-placeholder">?</div>
          <img
            v-if="actor.actorImage"
            :src="actor.actorImage"
            class="va-img va-img-actor"
            :alt="actor.actorName"
          />
        </div>
        <div class="va-info">
          <p class="va-character">{{ actor.characterName }}</p>
          <p class="va-actor">{{ actor.actorName }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.casting-section { margin-top: 1rem; }
.casting-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 12px;
  color: var(--c-text);
}
.casting-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.va-card {
  border: 1px solid var(--c-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--c-surface-2);
}
.va-images {
  display: flex;
  height: 80px;
  overflow: hidden;
}
.va-img {
  width: 50%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}
.va-img-placeholder {
  width: 50%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-bg);
  color: var(--c-muted);
  font-size: 20px;
}
.va-info { padding: 6px 8px; }
.va-character {
  font-size: 12px;
  font-weight: 500;
  color: var(--c-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.va-actor {
  font-size: 11px;
  color: var(--c-text-soft);
  margin: 1px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
