<script setup lang="ts">
/**
 * Neutral grey chip used for secondary metadata (episode count, rating, etc.).
 * Content is forwarded via the default slot.
 */
</script>

<template>
  <span class="meta-chip"><slot /></span>
</template>

<style scoped>
.meta-chip {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 100px;
  background: rgba(255, 255, 255, .05);
  border: 1px solid var(--c-border);
  color: var(--c-muted);
}
</style>
