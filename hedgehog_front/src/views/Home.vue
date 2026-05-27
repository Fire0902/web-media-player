<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useFileStore } from '@/utils/fileStore'
import AnimeCard from '@/components/anime/AnimeCard.vue'

const fileStore = useFileStore()
const searchQuery = ref('')

onMounted(async () => {
  await fileStore.getAll()
})

/** Library filtered against the case-insensitive search query. */
const filteredAnimes = computed(() => {
  const needle = searchQuery.value.trim().toLowerCase()
  if (!needle) return fileStore.animes
  return fileStore.animes.filter(anime =>
    anime.name.toLowerCase().includes(needle),
  )
})
</script>

<template>
  <section class="library">
    <header class="library-header">
      <div class="title-block">
        <h1 class="library-title heading-display">Bibliothèque</h1>
        <p v-if="!fileStore.loading" class="library-count">
          {{ fileStore.animes.length }} série{{ fileStore.animes.length > 1 ? 's' : '' }}
        </p>
      </div>

      <input
        v-model="searchQuery"
        type="search"
        class="library-search"
        placeholder="Rechercher…"
        aria-label="Rechercher dans la bibliothèque"
      />
    </header>

    <div v-if="fileStore.loading" class="library-state">
      <div class="loader" />
    </div>

    <div v-else-if="fileStore.animes.length === 0" class="library-state">
      <p class="state-title">Aucun média trouvé</p>
      <p class="state-sub">Déposez des fichiers dans <code>./media</code>.</p>
    </div>

    <div v-else-if="filteredAnimes.length === 0" class="library-state">
      <p class="state-title">Aucun résultat</p>
      <p class="state-sub">Essayez un autre terme de recherche.</p>
    </div>

    <div v-else class="library-grid">
      <AnimeCard v-for="anime in filteredAnimes" :key="anime.id" :anime="anime" />
    </div>
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
  margin-bottom: 32px;
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
.library-search {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 100px;
  color: var(--c-text);
  padding: 9px 16px;
  font-size: 13px;
  min-width: 240px;
  outline: none;
  transition: border-color var(--t-fast), background var(--t-fast);
}
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
  .library-search { width: 100%; }
}
</style>
