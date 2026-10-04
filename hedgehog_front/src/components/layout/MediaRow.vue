<script setup lang="ts">
/**
 * Titled, horizontally scrolling shelf used on the home page.
 * Cards are passed through the default slot.
 */
defineProps<{ title: string }>()
</script>

<template>
  <section class="media-row">
    <h2 class="row-title heading-display">{{ title }}</h2>
    <div class="row-scroller">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.media-row { margin-bottom: 36px; }
.row-title {
  font-size: 20px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-text-soft);
  margin: 0 0 14px;
}
.row-scroller {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  scroll-snap-type: x proximity;
}
</style>
