<script setup lang="ts">
import { formatPlaybackTime } from '@/utils/format'

/**
 * Scrubber + elapsed/total time row at the top of the controls overlay.
 */
defineProps<{
  currentTime: number
  duration: number
}>()

defineEmits<{ (event: 'seek', payload: Event): void }>()
</script>

<template>
  <div class="progress-row" @click.stop>
    <span class="time">{{ formatPlaybackTime(currentTime) }}</span>
    <input
      type="range"
      class="progress"
      :min="0"
      :max="duration || 100"
      step="0.1"
      :value="currentTime"
      @input="$emit('seek', $event)"
    />
    <span class="time">{{ formatPlaybackTime(duration) }}</span>
  </div>
</template>

<style scoped>
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 2px;
}
.time {
  font-size: 11px;
  color: rgba(255, 255, 255, .75);
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
}
.progress {
  flex: 1;
  height: 3px;
  accent-color: #fff;
  cursor: pointer;
}
</style>
