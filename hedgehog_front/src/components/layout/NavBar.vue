<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/utils/authStore'
import { useProgressStore } from '@/utils/progressStore'

const THEMES = ['default', 'gruvbox', 'tokyonight', 'light'] as const
type Theme = typeof THEMES[number]
const STORAGE_KEY = 'theme'

const router = useRouter()
const authStore = useAuthStore()
const progressStore = useProgressStore()

const currentTheme = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme) || 'default',
)
const isMenuOpen = ref(false)
const isThemeMenuOpen = ref(false)
const isUserMenuOpen = ref(false)

/** Apply a theme to the document root and persist the choice. */
function setTheme(theme: Theme) {
  currentTheme.value = theme
  localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
  isThemeMenuOpen.value = false
}

/** Revoke the session and return to the sign-in screen. */
async function logout() {
  isUserMenuOpen.value = false
  await authStore.logout()
  progressStore.reset()
  router.push({ name: 'sign-in' })
}

function closeMenus() {
  isThemeMenuOpen.value = false
  isUserMenuOpen.value = false
}

onMounted(() => {
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})
</script>

<template>
  <nav class="nav" role="navigation">
    <router-link to="/" class="nav-brand">
      <span class="logo-mark">🦔</span>
      <span class="logo-text">Hedgehog</span>
    </router-link>

    <button
      class="nav-burger"
      :class="{ 'is-active': isMenuOpen }"
      :aria-expanded="isMenuOpen"
      aria-label="Menu"
      @click="isMenuOpen = !isMenuOpen"
    >
      <span /><span /><span />
    </button>

    <div class="nav-end" :class="{ 'is-open': isMenuOpen }" @click="isMenuOpen = false">
      <router-link to="/" class="nav-link" exact-active-class="active">
        Accueil
      </router-link>
      <router-link v-if="authStore.isAdmin" to="/admin" class="nav-link" active-class="active">
        Administration
      </router-link>
      <router-link to="/settings" class="nav-link" active-class="active">
        Paramètres
      </router-link>

      <div class="theme-switch" @click.stop>
        <button
          class="theme-trigger"
          :aria-expanded="isThemeMenuOpen"
          @click="isThemeMenuOpen = !isThemeMenuOpen; isUserMenuOpen = false"
        >
          <span class="theme-dot" :data-theme="currentTheme" />
          <span class="theme-label">{{ currentTheme }}</span>
        </button>

        <transition name="fade">
          <ul v-if="isThemeMenuOpen" class="theme-menu">
            <li v-for="theme in THEMES" :key="theme">
              <button
                class="theme-item"
                :class="{ active: theme === currentTheme }"
                @click="setTheme(theme)"
              >
                <span class="theme-dot" :data-theme="theme" />
                {{ theme }}
              </button>
            </li>
          </ul>
        </transition>
      </div>

      <div v-if="authStore.user" class="theme-switch" @click.stop>
        <button
          class="theme-trigger user-trigger"
          :aria-expanded="isUserMenuOpen"
          @click="isUserMenuOpen = !isUserMenuOpen; isThemeMenuOpen = false"
        >
          <span class="user-avatar">{{ authStore.displayName.charAt(0).toUpperCase() }}</span>
          <span class="user-name">{{ authStore.displayName }}</span>
        </button>

        <transition name="fade">
          <ul v-if="isUserMenuOpen" class="theme-menu">
            <li class="user-role">
              {{ authStore.isAdmin ? 'Administrateur' : 'Utilisateur' }}
            </li>
            <li>
              <button class="theme-item" @click="logout">Se déconnecter</button>
            </li>
          </ul>
        </transition>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: color-mix(in srgb, var(--c-bg) 82%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 30;
}

.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--c-text);
  font-weight: 600;
  letter-spacing: .02em;
}
.logo-mark { font-size: 18px; }
.logo-text {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 19px;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.nav-burger {
  display: none;
  background: none;
  border: none;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  cursor: pointer;
}
.nav-burger span {
  display: block;
  width: 18px;
  height: 1.5px;
  background: var(--c-text);
}

.nav-end { display: flex; align-items: center; gap: 12px; }

.nav-link {
  font-size: 13px;
  letter-spacing: .04em;
  color: var(--c-text-soft);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: var(--r-sm);
  transition: color var(--t-fast), background var(--t-fast);
}
.nav-link:hover { color: var(--c-text); background: var(--c-surface-2); }
.nav-link.active { color: var(--c-text); background: var(--c-surface-2); }

.theme-switch { position: relative; }
.theme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-text-soft);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 12px;
  letter-spacing: .04em;
  cursor: pointer;
  transition: border-color var(--t-fast), color var(--t-fast);
  text-transform: capitalize;
}
.theme-trigger:hover {
  border-color: var(--c-border-strong);
  color: var(--c-text);
}

.user-trigger {
  text-transform: none;
  padding: 4px 12px 4px 4px;
}
.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--c-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-role {
  padding: 6px 10px 4px;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
}

.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-accent);
  border: 1px solid rgba(255, 255, 255, .25);
}
.theme-dot[data-theme="gruvbox"]    { background: #fb4934; }
.theme-dot[data-theme="tokyonight"] { background: #7aa2f7; }
.theme-dot[data-theme="light"]      { background: #f4f4f5; }

.theme-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  list-style: none;
  margin: 0;
  padding: 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  min-width: 160px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .4);
}
.theme-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: var(--r-sm);
  color: var(--c-text-soft);
  font-size: 12px;
  letter-spacing: .04em;
  cursor: pointer;
  text-align: left;
  text-transform: capitalize;
}
.theme-item:hover { background: var(--c-surface-2); color: var(--c-text); }
.theme-item.active { color: var(--c-text); font-weight: 500; }

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-fast); }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .nav { padding: 12px 14px; }
  .nav-burger { display: inline-flex; }
  .nav-end {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    padding: 12px 14px;
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
    display: none;
  }
  .nav-end.is-open { display: flex; }
  .theme-menu { position: static; box-shadow: none; margin-top: 6px; }
}
</style>
