<script setup lang="ts">
/**
 * Drop-up menu listing playback speeds.
 * Visibility is owned by the parent through `open` (v-model).
 */
defineProps<{
  open: boolean
  currentSpeed: number
  speeds: number[]
}>()

const emit = defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'select', speed: number): void
}>()

function selectSpeed(speed: number) {
  emit('select', speed)
}
</script>

<template>
  <div class="speed-wrap" @click.stop>
    <button class="btn btn-text" @click.stop="$emit('update:open', !open)">
      {{ currentSpeed }}x
    </button>
    <transition name="fade">
      <div v-if="open" class="speed-menu">
        <button
          v-for="speed in speeds"
          :key="speed"
          class="speed-item"
          :class="{ active: speed === currentSpeed }"
          @click.stop="selectSpeed(speed)"
        >
          {{ speed }}x
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.speed-wrap {
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
}
.btn:hover {
  background: rgba(255, 255, 255, .15);
}
.btn-text {
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, .4);
}
.speed-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: rgba(18, 18, 18, .95);
  border-radius: var(--r-sm);
  overflow: hidden;
  min-width: 64px;
  border: 0.5px solid rgba(255, 255, 255, .1);
}
.speed-item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, .7);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
}
.speed-item:hover {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}
.speed-item.active {
  color: #fff;
  font-weight: 500;
}
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-fast); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
