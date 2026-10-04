import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/utils/authStore'
import { useProgressStore } from '@/utils/progressStore'
import { onUnauthorized } from '@/utils/api'
import { authRoutes } from './routes/auth.routes'
import { mainRoutes } from './routes/main.routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...authRoutes, ...mainRoutes],
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
})

/**
 * Pre-navigation guard:
 *   - Checks the backend's `/setup` status once per session (cached in
 *     the auth store).
 *   - Redirects any non-setup route to `/setup` while the instance has
 *     no user, and conversely sends `/setup` back to `/sign-in` once a
 *     user already exists.
 *   - Protects the app behind a valid session, and the admin area
 *     behind the administrator role.
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (authStore.needsSetup === null) {
    await authStore.checkSetup()
  }
  if (authStore.needsSetup && to.name !== 'setup') {
    return { name: 'setup' }
  }
  if (!authStore.needsSetup && to.name === 'setup') {
    return { name: 'sign-in' }
  }

  // A token restored from localStorage still needs its user profile.
  if (authStore.token && !authStore.user) {
    const valid = await authStore.fetchUser()
    if (!valid) authStore.clearSession()
  }

  if (to.meta.requiresAuth && !authStore.token) {
    return { name: 'sign-in', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.name === 'sign-in' && authStore.token) {
    return { name: 'home' }
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'home' }
  }
})

// Token expired or revoked mid-session: back to the sign-in screen.
onUnauthorized(() => {
  const authStore = useAuthStore()
  if (!authStore.token) return
  authStore.clearSession()
  useProgressStore().reset()
  if (router.currentRoute.value.name !== 'sign-in') {
    router.push({ name: 'sign-in' })
  }
})

export default router
