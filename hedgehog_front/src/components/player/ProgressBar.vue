<script setup lang="ts">
import { computed } from 'vue'
import type { Chapter } from '@/types/media'
import { formatPlaybackTime } from '@/utils/format'

/**
 * Scrubber + elapsed/total time row at the top of the controls overlay.
 * Chapter boundaries, when the file has any, show up as ticks.
 */
const props = defineProps<{
  currentTime: number
  duration: number
  chapters?: Chapter[]
}>()

defineEmits<{ (event: 'seek', payload: Event): void }>()

/** Chapter starts as a percentage of the runtime (the first one is the start). */
const chapterMarks = computed(() => {
  if (!props.duration || !props.chapters?.length) return []
  return props.chapters
    .filter((chapter) => chapter.start > 0 && chapter.start < props.duration)
    .map((chapter) => ({
      left: `${(chapter.start / props.duration) * 100}%`,
      title: chapter.title ?? '',
    }))
})
</script>

<template>
  <div class="progress-row" @click.stop>
    <span class="time">{{ formatPlaybackTime(currentTime) }}</span>
    <div class="track">
      <input
        type="range"
        class="progress"
        aria-label="Position de lecture"
        :min="0"
        :max="duration || 100"
        step="0.1"
        :value="currentTime"
        @input="$emit('seek', $event)"
      />
      <span
        v-for="mark in chapterMarks"
        :key="mark.left"
        class="chapter-mark"
        :style="{ left: mark.left }"
        :title="mark.title"
      />
    </div>
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
  font-variant-numeric: tabular-nums;
}
.track {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}
.progress {
  width: 100%;
  height: 3px;
  accent-color: var(--c-accent);
  cursor: pointer;
  margin: 0;
}
.chapter-mark {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 7px;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, .7);
  pointer-events: none;
}
</style>
