<script setup lang="ts">
import type { NumberingMode } from '@/types/media'

/**
 * Segmented control that lets the user switch between per-season and
 * absolute (across-seasons) numbering on an anime detail page.
 */
defineProps<{ modelValue: NumberingMode }>()
defineEmits<{ (event: 'update:modelValue', mode: NumberingMode): void }>()
</script>

<template>
  <div class="numbering-toggle" role="group" aria-label="Mode de numérotation">
    <button
      class="toggle-opt"
      :class="{ active: modelValue === 'season' }"
      title="Numérotation remise à 1 par saison"
      @click="$emit('update:modelValue', 'season')"
    >
      Par saison
    </button>
    <button
      class="toggle-opt"
      :class="{ active: modelValue === 'absolute' }"
      title="Numérotation continue sur toutes les saisons"
      @click="$emit('update:modelValue', 'absolute')"
    >
      Global
    </button>
  </div>
</template>

<style scoped>
.numbering-toggle {
  display: flex;
  align-items: center;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.toggle-opt {
  font-size: 12px;
  font-weight: 500;
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--c-muted);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  letter-spacing: .02em;
}
.toggle-opt.active {
  background: var(--c-accent);
  color: #fff;
}
.toggle-opt:not(.active):hover {
  color: var(--c-text);
}
</style>
