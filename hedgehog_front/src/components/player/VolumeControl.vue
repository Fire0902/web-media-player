<script setup lang="ts">
import { computed } from 'vue'
import { VOLUME_HIGH_PATH, VOLUME_LOW_PATH, VOLUME_MUTE_PATH } from './icons'

/**
 * Volume icon + slider. The icon glyph follows the current volume bucket.
 */
const props = defineProps<{ volume: number }>()
const emit = defineEmits<{ (event: 'update:volume', value: number): void }>()

const iconPath = computed(() => {
  if (props.volume === 0) return VOLUME_MUTE_PATH
  if (props.volume < 0.5) return VOLUME_LOW_PATH
  return VOLUME_HIGH_PATH
})

function onInput(event: Event) {
  emit('update:volume', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="volume" @click.stop>
    <svg viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0">
      <path :d="iconPath" fill="white" />
    </svg>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      :value="volume"
      class="volume-slider"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.volume {
  display: flex;
  align-items: center;
  gap: 6px;
}
.volume-slider {
  width: 70px;
  height: 3px;
  accent-color: #fff;
  cursor: pointer;
}
</style>
