<script setup lang="ts" generic="T extends string | number">
/**
 * Generic drop-up menu for the player's transport bar (audio track,
 * quality…). Mirrors the API of `SpeedMenu`: the parent owns `open`
 * via v-model and receives the picked value through `select`.
 */
defineProps<{
  open: boolean
  /** Text shown on the trigger button. */
  label: string
  /** Accessible name of the trigger. */
  title: string
  options: { value: T; label: string; hint?: string }[]
  selected: T
}>()

defineEmits<{
  (event: 'update:open', open: boolean): void
  (event: 'select', value: T): void
}>()
</script>

<template>
  <div class="menu-wrap" @click.stop>
    <button
      class="btn btn-text"
      :aria-label="title"
      :title="title"
      @click.stop="$emit('update:open', !open)"
    >
      {{ label }}
    </button>

    <transition name="fade">
      <div v-if="open" class="menu">
        <p class="menu-title">{{ title }}</p>
        <button
          v-for="option in options"
          :key="option.value"
          class="menu-item"
          :class="{ active: option.value === selected }"
          @click.stop="$emit('select', option.value)"
        >
          <span>{{ option.label }}</span>
          <span v-if="option.hint" class="menu-hint">{{ option.hint }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.menu-wrap {
  position: relative;
}
.btn {
  background: none;
  border: none;
  cursor: pointer;
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
  white-space: nowrap;
}
.menu {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: rgba(18, 18, 18, .95);
  border-radius: var(--r-sm);
  overflow: hidden;
  min-width: 170px;
  border: 1px solid rgba(255, 255, 255, .1);
  padding: 4px 0;
}
.menu-title {
  margin: 0;
  padding: 6px 14px 4px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .4);
}
.menu-item {
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
  white-space: nowrap;
}
.menu-item:hover {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}
.menu-item.active {
  color: #fff;
  font-weight: 500;
}
.menu-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, .35);
  letter-spacing: .04em;
  text-transform: uppercase;
}
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-fast); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
