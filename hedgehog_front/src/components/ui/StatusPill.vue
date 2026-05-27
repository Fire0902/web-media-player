<script setup lang="ts">
import { computed } from 'vue'

/**
 * Small colored badge used to flag airing status on cards, headers and seasons.
 * `size="sm"` shrinks the typography for inline use inside dense lists.
 */
const props = withDefaults(
  defineProps<{
    status: string | null
    size?: 'md' | 'sm'
    /** Switch the "ended" label between masculine and feminine (saison terminée). */
    feminineEnded?: boolean
  }>(),
  { size: 'md', feminineEnded: false },
)

const isAiring = computed(() => props.status === 'Currently Airing')

const label = computed(() => {
  if (!props.status) return ''
  if (isAiring.value) return 'En cours'
  return props.feminineEnded ? 'Terminée' : 'Terminé'
})
</script>

<template>
  <span
    v-if="status"
    class="status-pill"
    :class="[isAiring ? 'is-airing' : 'is-ended', size === 'sm' ? 'is-sm' : '']"
  >
    <span class="status-dot" />
    {{ label }}
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .04em;
  padding: 4px 10px;
  border-radius: 100px;
  border: 1px solid transparent;
}
.status-pill.is-sm {
  font-size: 10px;
  padding: 3px 8px;
}
.status-pill.is-airing {
  background: rgba(48, 209, 88, .1);
  border-color: rgba(48, 209, 88, .25);
  color: var(--c-airing);
}
.status-pill.is-ended {
  background: rgba(255, 255, 255, .05);
  border-color: var(--c-border);
  color: var(--c-muted);
}
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
</style>
