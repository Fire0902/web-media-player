<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFileStore } from '@/utils/fileStore'
import type { Episode, NumberingMode } from '@/types/media'
import AnimeHero from '@/components/anime/AnimeHero.vue'
import SeasonAccordion from '@/components/anime/SeasonAccordion.vue'
import NumberingToggle from '@/components/anime/NumberingToggle.vue'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'

const route = useRoute()
const router = useRouter()
const fileStore = useFileStore()

const numberingMode = ref<NumberingMode>('season')

/** Anime matching the `:id` route param, or `undefined` while loading. */
const anime = computed(() =>
  fileStore.animes.find(item => item.id === Number(route.params.id)),
)

onMounted(async () => {
  if (fileStore.animes.length === 0) await fileStore.getAll()
})

/** Navigate to the player view for the chosen episode. */
function play(episode: Episode) {
  router.push({ name: 'player', params: { id: episode.id } })
}
</script>

<template>
  <div class="detail-root">
    <div
      v-if="anime?.coverUrl"
      class="backdrop"
      :style="{ backgroundImage: `url(${anime.coverUrl})` }"
    />
    <div class="backdrop-overlay" />

    <div class="detail-content">
      <router-link to="/" class="back-link">
        <IconArrowLeft />
        Bibliothèque
      </router-link>

      <div v-if="!anime" class="empty-state">
        <p>Anime introuvable.</p>
      </div>

      <template v-else>
        <AnimeHero :anime="anime" />

        <section class="seasons-section">
          <div class="section-header">
            <h2 class="section-title heading-display">Épisodes</h2>
            <NumberingToggle v-model="numberingMode" />
          </div>

          <SeasonAccordion
            v-for="season in anime.seasons"
            :key="season.name"
            :season="season"
            :numbering-mode="numberingMode"
            @play="play"
          />
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.detail-root {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.backdrop {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center top;
  filter: blur(60px) saturate(0.4);
  opacity: .18;
  pointer-events: none;
  z-index: 0;
  transform: scale(1.1);
}
.backdrop-overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom, var(--c-bg) 0%, transparent 30%, var(--c-bg) 80%);
  pointer-events: none;
  z-index: 0;
}

.detail-content {
  position: relative;
  z-index: 1;
  max-width: 1060px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-muted);
  text-decoration: none;
  margin-bottom: 40px;
  transition: color var(--t-fast);
  letter-spacing: .02em;
}
.back-link:hover { color: var(--c-text); }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.section-title {
  font-size: 22px;
  letter-spacing: .08em;
  color: var(--c-muted);
  margin: 0;
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: var(--c-muted);
}
</style>
