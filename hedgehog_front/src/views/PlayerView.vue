<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFileStore } from '@/utils/fileStore'
import { useAuthStore } from '@/utils/authStore'
import type { Episode } from '@/types/media'
import VideoPlayer from '@/components/player/VideoPlayer.vue'
import EpisodeDetails from '@/components/player/EpisodeDetails.vue'
import UpNextList from '@/components/player/UpNextList.vue'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'
import { API_BASE_URL } from '@/config'

const BACKEND_BASE_URL = API_BASE_URL

const props = defineProps<{ id: string }>()

const router = useRouter()
const fileStore = useFileStore()
const authStore = useAuthStore()

/** Episode id currently loaded in the player (mutates without navigation). */
const currentId = ref(props.id)

/** Episode object currently playing, looked up across the whole library. */
const currentEpisode = computed(() =>
  fileStore.allEpisodes.find(episode => String(episode.id) === currentId.value) ?? null,
)

/**
 * Locate the anime + season that contain the current episode.
 * Returns null while the library is still loading.
 */
const currentContext = computed(() => {
  for (const anime of fileStore.animes) {
    for (const season of anime.seasons) {
      if (season.episodes.some(episode => String(episode.id) === currentId.value)) {
        return { anime, season }
      }
    }
  }
  return null
})

const currentAnime = computed(() => currentContext.value?.anime ?? null)
const currentSeason = computed(() => currentContext.value?.season ?? null)

const currentIndex = computed(() =>
  currentSeason.value?.episodes.findIndex(
    episode => String(episode.id) === currentId.value,
  ) ?? -1,
)

const nextEpisode = computed<Episode | null>(() =>
  currentIndex.value >= 0
    ? currentSeason.value?.episodes[currentIndex.value + 1] ?? null
    : null,
)

const prevEpisode = computed<Episode | null>(() =>
  currentIndex.value > 0
    ? currentSeason.value?.episodes[currentIndex.value - 1] ?? null
    : null,
)

const upcomingEpisodes = computed(() =>
  currentSeason.value?.episodes.slice(currentIndex.value + 1) ?? [],
)

/** Authenticated stream URL for the current episode. */
const streamUrl = computed(
  () => `${BACKEND_BASE_URL}/stream/${currentId.value}?token=${authStore.token}`,
)

/** Swap the active episode without leaving the player route. */
function selectEpisode(episode: Episode) {
  currentId.value = String(episode.id)
}

function goToAnime() {
  if (currentAnime.value) {
    router.push({ name: 'anime', params: { id: currentAnime.value.id } })
  }
}

onMounted(async () => {
  if (fileStore.animes.length === 0) await fileStore.getAll()
})

watch(
  () => props.id,
  newId => { currentId.value = newId },
)
</script>

<template>
  <section class="player-page">
    <div class="player-shell">
      <router-link to="/" class="back-link">
        <IconArrowLeft />
        Bibliothèque
      </router-link>

      <div class="player-grid">
        <div class="player-main">
          <VideoPlayer
            v-if="currentEpisode"
            :src="streamUrl"
            :title="currentEpisode.title ?? currentEpisode.name"
            :season-name="currentSeason?.name ?? ''"
            :anime-name="currentAnime?.name ?? ''"
            :next-episode="nextEpisode"
            :prev-episode="prevEpisode"
            @play-episode="selectEpisode"
            @go-anime="goToAnime"
            @go-season="goToAnime"
          />

          <EpisodeDetails
            v-if="currentEpisode"
            :episode="currentEpisode"
            :anime="currentAnime"
            class="mt-4"
          />
        </div>

        <UpNextList :episodes="upcomingEpisodes" @select="selectEpisode" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.player-page {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  padding: 32px 28px 80px;
}
.player-shell {
  max-width: 1400px;
  margin: 0 auto;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-muted);
  text-decoration: none;
  margin-bottom: 24px;
  letter-spacing: .02em;
  transition: color var(--t-fast);
}
.back-link:hover { color: var(--c-text); }

.player-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 32px;
}

.player-main { min-width: 0; }
.mt-4 { margin-top: 1rem; }

@media (max-width: 1024px) {
  .player-grid {
    grid-template-columns: 1fr;
  }
}
</style>
