<script setup lang="ts">
import { SEEK_LEFT_PATH, SEEK_RIGHT_PATH } from './icons'

/** Floating "-5s / +5s" pill displayed after a double-tap seek. */
defineProps<{ side: 'left' | 'right' | null }>()
</script>

<template>
  <transition name="fade">
    <div v-if="side === 'left'" class="hint hint-left">
      <svg viewBox="0 0 24 24" width="20" height="20"><path :d="SEEK_LEFT_PATH" fill="white" /></svg>
      <span>-5s</span>
    </div>
  </transition>
  <transition name="fade">
    <div v-if="side === 'right'" class="hint hint-right">
      <span>+5s</span>
      <svg viewBox="0 0 24 24" width="20" height="20"><path :d="SEEK_RIGHT_PATH" fill="white" /></svg>
    </div>
  </transition>
</template>

<style scoped>
.hint {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, .45);
  padding: 8px 14px;
  border-radius: 20px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
}
.hint-left { left: 10%; }
.hint-right { right: 10%; }

.fade-enter-active, .fade-leave-active { transition: opacity .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
