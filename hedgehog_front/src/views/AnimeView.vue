<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/utils/api'
import { useFileStore } from '@/utils/fileStore'
import { useAuthStore } from '@/utils/authStore'
import { useProgressStore } from '@/utils/progressStore'
import type { Episode, NumberingMode } from '@/types/media'
import { formatEpisodeNumber } from '@/utils/format'
import AnimeHero from '@/components/anime/AnimeHero.vue'
import SeasonAccordion from '@/components/anime/SeasonAccordion.vue'
import NumberingToggle from '@/components/anime/NumberingToggle.vue'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'
import IconPlay from '@/components/ui/IconPlay.vue'

const route = useRoute()
const router = useRouter()
const fileStore = useFileStore()
const authStore = useAuthStore()
const progressStore = useProgressStore()

const numberingMode = ref<NumberingMode>('season')

/** Anime matching the `:id` route param, or `undefined` while loading. */
const anime = computed(() =>
  fileStore.animes.find(item => item.id === Number(route.params.id)),
)

const episodes = computed(() => anime.value?.seasons.flatMap(season => season.episodes) ?? [])

/** Episode the big "Play" button launches (in progress → next unwatched → first). */
const resumeTarget = computed(() => (anime.value ? progressStore.resumeTarget(anime.value) : null))

const hasHistory = computed(() =>
  episodes.value.some(
    episode => progressStore.isWatched(episode.id) || progressStore.positionOf(episode.id) > 0,
  ),
)

const allWatched = computed(
  () =>
    episodes.value.length > 0 && episodes.value.every(episode => progressStore.isWatched(episode.id)),
)

const playLabel = computed(() => {
  const target = resumeTarget.value
  if (!target) return 'Lecture'
  if (!hasHistory.value || allWatched.value) return 'Lecture'
  const verb = progressStore.positionOf(target.id) > 0 ? 'Reprendre' : 'Continuer'
  return `${verb} · Ép. ${formatEpisodeNumber(target, 'season')}`
})

const isFavorite = computed(() => (anime.value ? progressStore.isFavorite(anime.value.id) : false))

onMounted(async () => {
  await Promise.all([
    fileStore.animes.length === 0 ? fileStore.getAll() : Promise.resolve(),
    progressStore.ensureLoaded().catch(() => {}),
  ])
})

/** Navigate to the player view for the chosen episode. */
function play(episode: Episode) {
  router.push({ name: 'player', params: { id: episode.id } })
}

function playResume() {
  if (resumeTarget.value) play(resumeTarget.value)
}

function toggleFavorite() {
  if (anime.value) progressStore.toggleFavorite(anime.value.id)
}

function toggleAllWatched() {
  if (anime.value) progressStore.setAnimeWatched(anime.value.id, !allWatched.value)
}

// ── Metadata management (administrators) ───────────────────────────────

const metadataOpen = ref(false)
const malIdInput = ref('')
const metadataBusy = ref(false)
const metadataMessage = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

function openMetadata() {
  malIdInput.value = anime.value?.malId ? String(anime.value.malId) : ''
  metadataMessage.value = null
  metadataOpen.value = !metadataOpen.value
}

/**
 * Re-fetch metadata from MyAnimeList. With an id the match is forced
 * to that entry; without, the folder name is searched again.
 */
async function refreshMetadata(useId: boolean) {
  if (!anime.value) return
  const malId = useId ? Number(malIdInput.value) : undefined
  if (useId && (!Number.isInteger(malId) || (malId as number) <= 0)) {
    metadataMessage.value = { kind: 'error', text: 'Identifiant MyAnimeList invalide.' }
    return
  }

  metadataBusy.value = true
  metadataMessage.value = null
  try {
    await api.post(`/animes/${anime.value.id}/metadata`, useId ? { malId } : {})
    await fileStore.getAll()
    metadataMessage.value = {
      kind: 'ok',
      text: 'Métadonnées mises à jour. Les titres des épisodes arrivent avec le scan en cours.',
    }
  } catch (err: any) {
    metadataMessage.value = { kind: 'error', text: err?.message ?? 'Échec de la mise à jour.' }
  } finally {
    metadataBusy.value = false
  }
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

      <div v-if="!anime && fileStore.loading" class="empty-state">
        <p>Chargement…</p>
      </div>

      <div v-else-if="!anime" class="empty-state">
        <p>Anime introuvable.</p>
      </div>

      <template v-else>
        <AnimeHero :anime="anime">
          <template #actions>
            <button v-if="resumeTarget" class="action-btn primary" @click="playResume">
              <IconPlay :size="18" />
              {{ playLabel }}
            </button>
            <button
              class="action-btn"
              :class="{ active: isFavorite }"
              :aria-pressed="isFavorite"
              @click="toggleFavorite"
            >
              {{ isFavorite ? '♥ Favori' : '♡ Favori' }}
            </button>
            <button
              class="action-btn"
              :class="{ done: allWatched }"
              :aria-pressed="allWatched"
              @click="toggleAllWatched"
            >
              {{ allWatched ? '✓ Vu' : 'Marquer comme vu' }}
            </button>
            <button
              v-if="authStore.isAdmin"
              class="action-btn"
              :aria-expanded="metadataOpen"
              @click="openMetadata"
            >
              Métadonnées
            </button>
          </template>
        </AnimeHero>

        <section v-if="authStore.isAdmin && metadataOpen" class="metadata-panel">
          <h2 class="metadata-title">Identifier sur MyAnimeList</h2>
          <p class="metadata-desc">
            Mauvaise fiche ? Indiquez l'identifiant MyAnimeList (le nombre dans l'URL
            <code>myanimelist.net/anime/<strong>21</strong>/…</code>), ou relancez la recherche
            automatique à partir du nom du dossier.
          </p>
          <form class="metadata-form" @submit.prevent="refreshMetadata(true)">
            <input
              v-model="malIdInput"
              class="metadata-input"
              type="number"
              min="1"
              inputmode="numeric"
              placeholder="ID MyAnimeList"
              aria-label="Identifiant MyAnimeList"
            />
            <button class="action-btn primary" type="submit" :disabled="metadataBusy">
              Appliquer cet ID
            </button>
            <button
              class="action-btn"
              type="button"
              :disabled="metadataBusy"
              @click="refreshMetadata(false)"
            >
              Recherche automatique
            </button>
          </form>
          <p
            v-if="metadataMessage"
            class="metadata-message"
            :class="metadataMessage.kind"
            role="status"
          >
            {{ metadataMessage.text }}
          </p>
        </section>

        <section class="seasons-section">
          <div class="section-header">
            <h2 class="section-title heading-display">Épisodes</h2>
            <NumberingToggle v-model="numberingMode" />
          </div>

          <SeasonAccordion
            v-for="season in anime.seasons"
            :key="season.id"
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

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 16px;
  border-radius: 100px;
  cursor: pointer;
  transition: border-color var(--t-fast), color var(--t-fast), filter var(--t-fast);
}
.action-btn:hover { color: var(--c-text); border-color: var(--c-muted); }
.action-btn:disabled { opacity: .6; cursor: default; }
.action-btn.primary {
  background: var(--c-accent);
  border-color: var(--c-accent);
  color: #fff;
  font-weight: 600;
}
.action-btn.primary:hover:not(:disabled) { filter: brightness(1.1); }
.action-btn.active { color: var(--c-accent); border-color: var(--c-accent); }
.action-btn.done { color: var(--c-airing); border-color: var(--c-airing); }

.metadata-panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  padding: 20px 22px;
  margin: -32px 0 40px;
}
.metadata-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 500;
}
.metadata-desc {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--c-muted);
  max-width: 640px;
}
.metadata-desc code {
  background: var(--c-surface-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.metadata-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.metadata-input {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 100px;
  padding: 9px 16px;
  color: var(--c-text);
  font-size: 13px;
  width: 170px;
  outline: none;
}
.metadata-input:focus { border-color: var(--c-accent); }
.metadata-message {
  margin: 12px 0 0;
  font-size: 13px;
}
.metadata-message.ok { color: var(--c-airing); }
.metadata-message.error { color: var(--c-accent); }

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

@media (max-width: 600px) {
  .detail-content { padding: 20px 14px 60px; }
}
</style>
