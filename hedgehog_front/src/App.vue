<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from '@/components/layout/NavBar.vue'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'default'
  document.documentElement.setAttribute('data-theme', savedTheme)
})
</script>

<template>
  <NavBar v-if="route.name !== 'sign-in' && route.name !== 'sign-up'" />
  <main class="app-main">
    <router-view />
  </main>
</template>

<style>
@import '@/styles/variables.css';
@import '@/styles/themes.css';
@import '@/styles/base.css';

.app-main {
  min-height: calc(100vh - 62px);
}
</style>
