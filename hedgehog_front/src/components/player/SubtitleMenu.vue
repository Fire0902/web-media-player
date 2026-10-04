<script setup lang="ts">
import type { SubtitleTrack } from '@/types/subtitles'

/**
 * Drop-up menu listing subtitle tracks plus an "Off" entry.
 * Mirrors the API of `SpeedMenu`: parent owns `open` via v-model.
 */
defineProps<{
  open: boolean
  tracks: SubtitleTrack[]
  selectedTrackId: string | null
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'select', trackId: string | null): void
}>()

function select(trackId: string | null) {
  emit('select', trackId)
}
</script>

<template>
  <div class="subs-wrap" @click.stop>
    <button
      class="btn"
      :class="{ active: selectedTrackId }"
      aria-label="Sous-titres"
      @click.stop="$emit('update:open', !open)"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
      </svg>
    </button>

    <transition name="fade">
      <div v-if="open" class="subs-menu">
        <button
          class="subs-item"
          :class="{ active: selectedTrackId === null }"
          @click.stop="select(null)"
        >
          Off
        </button>
        <button
          v-for="track in tracks"
          :key="track.id"
          class="subs-item"
          :class="{ active: track.id === selectedTrackId }"
          @click.stop="select(track.id)"
        >
          <span class="subs-label">{{ track.label }}</span>
          <span class="subs-format">{{ track.format }}</span>
        </button>

        <p v-if="!tracks.length" class="subs-empty">Aucune piste disponible.</p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.subs-wrap {
  position: relative;
}
.btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast);
  color: rgba(255, 255, 255, .9);
}
.btn:hover { background: rgba(255, 255, 255, .15); }
.btn.active { color: var(--c-accent); }

.subs-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: rgba(18, 18, 18, .95);
  border-radius: var(--r-sm);
  overflow: hidden;
  min-width: 140px;
  border: 1px solid rgba(255, 255, 255, .1);
  padding: 4px 0;
}
.subs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 6px 14px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, .7);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.subs-item:hover {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}
.subs-item.active {
  color: #fff;
  font-weight: 500;
}
.subs-label { text-transform: capitalize; }
.subs-format {
  font-size: 10px;
  color: rgba(255, 255, 255, .35);
  letter-spacing: .04em;
  text-transform: uppercase;
}
.subs-empty {
  margin: 0;
  padding: 8px 14px;
  font-size: 11px;
  color: rgba(255, 255, 255, .45);
  font-style: italic;
}

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-fast); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
