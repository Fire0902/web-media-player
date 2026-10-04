<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useFileStore } from '@/utils/fileStore'
import { useProgressStore } from '@/utils/progressStore'
import type { Anime, EpisodeContext } from '@/types/media'
import AnimeCard from '@/components/anime/AnimeCard.vue'
import EpisodeCard from '@/components/anime/EpisodeCard.vue'
import MediaRow from '@/components/layout/MediaRow.vue'

type SortMode = 'name' | 'recent' | 'episodes'

/** Number of cards in the "Ajouts récents" shelf. */
const RECENT_LIMIT = 16

const fileStore = useFileStore()
const progressStore = useProgressStore()

const searchQuery = ref('')
const selectedGenre = ref('')
const sortMode = ref<SortMode>('name')
const favoritesOnly = ref(false)

onMounted(async () => {
  await Promise.all([fileStore.getAll(), progressStore.load().catch(() => {})])
})

/** Every genre present in the library, for the filter dropdown. */
const genres = computed(() => {
  const all = new Set<string>()
  for (const anime of fileStore.animes) {
    for (const genre of anime.genres ?? []) all.add(genre)
  }
  return [...all].sort((a, b) => a.localeCompare(b))
})

/** Most recent episode date of an anime, used by the "recent" sort. */
function latestAddition(anime: Anime): string {
  let latest = anime.createdAt ?? ''
  for (const season of anime.seasons) {
    for (const episode of season.episodes) {
      if (episode.createdAt > latest) latest = episode.createdAt
    }
  }
  return latest
}

function episodeCount(anime: Anime): number {
  return anime.seasons.reduce((sum, season) => sum + season.episodes.length, 0)
}

/** Library after search, genre and favorite filters, then sorted. */
const filteredAnimes = computed(() => {
  const needle = searchQuery.value.trim().toLowerCase()
  const filtered = fileStore.animes.filter(anime => {
    if (needle && !anime.name.toLowerCase().includes(needle)) return false
    if (selectedGenre.value && !anime.genres?.includes(selectedGenre.value)) return false
    if (favoritesOnly.value && !progressStore.isFavorite(anime.id)) return false
    return true
  })

  switch (sortMode.value) {
    case 'recent':
      return filtered.sort((a, b) => latestAddition(b).localeCompare(latestAddition(a)))
    case 'episodes':
      return filtered.sort((a, b) => episodeCount(b) - episodeCount(a))
    default:
      return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }
})

/** Latest episodes dropped in the media folder, newest first. */
const recentlyAdded = computed<EpisodeContext[]>(() => {
  const items: EpisodeContext[] = []
  for (const anime of fileStore.animes) {
    for (const season of anime.seasons) {
      for (const episode of season.episodes) items.push({ episode, season, anime })
    }
  }
  return items
    .sort((a, b) => b.episode.createdAt.localeCompare(a.episode.createdAt))
    .slice(0, RECENT_LIMIT)
})

const isFiltering = computed(
  () => Boolean(searchQuery.value.trim()) || Boolean(selectedGenre.value) || favoritesOnly.value,
)
</script>

<template>
  <section class="library">
    <div v-if="fileStore.loading && fileStore.animes.length === 0" class="library-state">
      <div class="loader" />
    </div>

    <div v-else-if="fileStore.error" class="library-state">
      <p class="state-title">Impossible de charger la bibliothèque</p>
      <p class="state-sub">Vérifiez que le serveur est démarré, puis rechargez la page.</p>
    </div>

    <div v-else-if="fileStore.animes.length === 0" class="library-state">
      <p class="state-title">Aucun média trouvé</p>
      <p class="state-sub">Déposez des fichiers dans <code>./media</code>.</p>
    </div>

    <template v-else>
      <template v-if="!isFiltering">
        <MediaRow v-if="progressStore.continueWatching.length" title="Reprendre la lecture">
          <EpisodeCard
            v-for="item in progressStore.continueWatching"
            :key="item.episode.id"
            :item="item"
          />
        </MediaRow>

        <MediaRow v-if="progressStore.nextUp.length" title="À suivre">
          <EpisodeCard v-for="item in progressStore.nextUp" :key="item.episode.id" :item="item" />
        </MediaRow>

        <MediaRow title="Ajouts récents">
          <EpisodeCard v-for="item in recentlyAdded" :key="item.episode.id" :item="item" />
        </MediaRow>
      </template>

      <header class="library-header">
        <div class="title-block">
          <h1 class="library-title heading-display">Bibliothèque</h1>
          <p class="library-count">
            {{ filteredAnimes.length }} série{{ filteredAnimes.length > 1 ? 's' : '' }}
          </p>
        </div>

        <div class="library-filters">
          <button
            class="filter-chip"
            :class="{ active: favoritesOnly }"
            :aria-pressed="favoritesOnly"
            @click="favoritesOnly = !favoritesOnly"
          >
            ♥ Favoris
          </button>

          <select
            v-if="genres.length"
            v-model="selectedGenre"
            class="filter-select"
            aria-label="Filtrer par genre"
          >
            <option value="">Tous les genres</option>
            <option v-for="genre in genres" :key="genre" :value="genre">{{ genre }}</option>
          </select>

          <select v-model="sortMode" class="filter-select" aria-label="Trier">
            <option value="name">Nom</option>
            <option value="recent">Ajout récent</option>
            <option value="episodes">Nombre d'épisodes</option>
          </select>

          <input
            v-model="searchQuery"
            type="search"
            class="library-search"
            placeholder="Rechercher…"
            aria-label="Rechercher dans la bibliothèque"
          />
        </div>
      </header>

      <div v-if="filteredAnimes.length === 0" class="library-state">
        <p class="state-title">Aucun résultat</p>
        <p class="state-sub">Essayez d'autres filtres ou un autre terme de recherche.</p>
      </div>

      <div v-else class="library-grid">
        <AnimeCard v-for="anime in filteredAnimes" :key="anime.id" :anime="anime" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.library {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 28px 80px;
}

.library-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}
.title-block {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.library-title {
  font-size: clamp(32px, 4vw, 48px);
  margin: 0;
  color: var(--c-text);
  letter-spacing: .04em;
}
.library-count {
  font-size: 12px;
  color: var(--c-muted);
  letter-spacing: .08em;
  text-transform: uppercase;
  margin: 0;
}

.library-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filter-chip,
.filter-select,
.library-search {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 100px;
  color: var(--c-text);
  padding: 9px 16px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.filter-chip { cursor: pointer; color: var(--c-text-soft); }
.filter-chip:hover { border-color: var(--c-border-strong); }
.filter-chip.active {
  border-color: var(--c-accent);
  color: var(--c-accent);
}
.filter-select { cursor: pointer; }
.filter-select option { background: var(--c-surface); color: var(--c-text); }
.library-search { min-width: 220px; }
.filter-select:focus,
.library-search:focus {
  border-color: var(--c-accent);
  background: var(--c-surface-2);
}
.library-search::placeholder { color: var(--c-muted); }

.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.library-state {
  text-align: center;
  padding: 80px 0;
  color: var(--c-muted);
}
.state-title { font-size: 16px; margin: 0 0 6px; color: var(--c-text); }
.state-sub   { font-size: 13px; margin: 0; }
.state-sub code {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 1px 6px;
}

.loader {
  margin: 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--c-border-strong);
  border-top-color: var(--c-accent);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .library { padding: 24px 14px 60px; }
  .library-search { width: 100%; }
  .library-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
}
</style>
