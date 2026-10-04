<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '@/utils/api'
import { useAuthStore, type User } from '@/utils/authStore'
import { useFileStore } from '@/utils/fileStore'
import { formatDuration, formatFileSize, formatPlaybackTime } from '@/utils/format'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'

interface Dashboard {
  library: {
    animes: number
    seasons: number
    episodes: number
    users: number
    totalSize: number
    totalDuration: number
  }
  scan: {
    scanning: boolean
    lastScanAt: string | null
    lastDurationMs: number | null
    lastError: string | null
  }
  ffmpeg: string | null
  activeTranscodes: number
  sessions: {
    userName: string
    episodeId: number
    episodeTitle: string | null
    episodeNumber: number | null
    animeName: string | null
    position: number
    duration: number | null
    method: string
    paused: boolean
  }[]
}

/** How often the dashboard refreshes while the page is open. */
const REFRESH_INTERVAL_MS = 5000
const MIN_PASSWORD_LENGTH = 8

const METHOD_LABELS: Record<string, string> = {
  direct: 'Lecture directe',
  remux: 'Remux',
  transcode: 'Transcodage',
}

const authStore = useAuthStore()
const fileStore = useFileStore()

const dashboard = ref<Dashboard | null>(null)
const dashboardError = ref<string | null>(null)
const users = ref<User[]>([])
let refreshTimer: ReturnType<typeof setInterval> | null = null
let wasScanning = false

const stats = computed(() => {
  const library = dashboard.value?.library
  if (!library) return []
  return [
    { label: 'Séries', value: String(library.animes) },
    { label: 'Saisons', value: String(library.seasons) },
    { label: 'Épisodes', value: String(library.episodes) },
    { label: 'Durée totale', value: formatDuration(library.totalDuration) || '—' },
    { label: 'Espace disque', value: formatFileSize(library.totalSize) },
    { label: 'Utilisateurs', value: String(library.users) },
  ]
})

const lastScanLabel = computed(() => {
  const scan = dashboard.value?.scan
  if (!scan) return ''
  if (scan.scanning) return 'Scan en cours…'
  if (!scan.lastScanAt) return 'Aucun scan depuis le démarrage du serveur.'
  const when = new Date(scan.lastScanAt).toLocaleString('fr-FR')
  const took = scan.lastDurationMs !== null ? ` (${Math.round(scan.lastDurationMs / 1000)} s)` : ''
  return `Dernier scan : ${when}${took}`
})

async function loadDashboard() {
  try {
    const { data } = await api.get<Dashboard>('/admin/dashboard')
    dashboard.value = data
    dashboardError.value = null
    // A scan just finished: the library shown elsewhere is now stale.
    if (wasScanning && !data.scan.scanning) fileStore.getAll()
    wasScanning = data.scan.scanning
  } catch (err: any) {
    dashboardError.value = err?.message ?? 'Tableau de bord indisponible.'
  }
}

async function loadUsers() {
  const { data } = await api.get<User[]>('/users')
  users.value = data
}

async function startScan() {
  if (dashboard.value) dashboard.value.scan.scanning = true
  wasScanning = true
  try {
    await api.post('/library/scan', {})
  } finally {
    await loadDashboard()
  }
}

// ── User management ────────────────────────────────────────────────────

const newUser = ref({ email: '', pseudo: '', password: '', isAdmin: false })
const userBusy = ref(false)
const userMessage = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
/** User whose row currently shows the password-reset field. */
const resetUserId = ref<number | null>(null)
const resetPassword = ref('')
/** User whose deletion is awaiting confirmation. */
const deleteUserId = ref<number | null>(null)

function fail(err: any, fallback: string) {
  userMessage.value = { kind: 'error', text: err?.message ?? fallback }
}

async function createUser() {
  userMessage.value = null
  if (newUser.value.password.length < MIN_PASSWORD_LENGTH) {
    userMessage.value = {
      kind: 'error',
      text: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    }
    return
  }
  userBusy.value = true
  try {
    await api.post('/users', newUser.value)
    userMessage.value = { kind: 'ok', text: `Compte créé pour ${newUser.value.email}.` }
    newUser.value = { email: '', pseudo: '', password: '', isAdmin: false }
    await Promise.all([loadUsers(), loadDashboard()])
  } catch (err) {
    fail(err, 'Création impossible.')
  } finally {
    userBusy.value = false
  }
}

async function toggleAdmin(user: User) {
  userMessage.value = null
  try {
    await api.put(`/users/${user.id}`, { isAdmin: !user.isAdmin })
    await loadUsers()
  } catch (err) {
    fail(err, 'Modification impossible.')
  }
}

function openReset(user: User) {
  deleteUserId.value = null
  resetPassword.value = ''
  resetUserId.value = resetUserId.value === user.id ? null : user.id
}

async function submitReset(user: User) {
  userMessage.value = null
  if (resetPassword.value.length < MIN_PASSWORD_LENGTH) {
    userMessage.value = {
      kind: 'error',
      text: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    }
    return
  }
  try {
    await api.put(`/users/${user.id}`, { password: resetPassword.value })
    userMessage.value = { kind: 'ok', text: `Mot de passe de ${user.email} réinitialisé.` }
    resetUserId.value = null
    resetPassword.value = ''
  } catch (err) {
    fail(err, 'Réinitialisation impossible.')
  }
}

async function deleteUser(user: User) {
  userMessage.value = null
  try {
    await api.delete(`/users/${user.id}`)
    userMessage.value = { kind: 'ok', text: `Compte ${user.email} supprimé.` }
    deleteUserId.value = null
    await Promise.all([loadUsers(), loadDashboard()])
  } catch (err) {
    fail(err, 'Suppression impossible.')
  }
}

onMounted(async () => {
  await Promise.all([loadDashboard(), loadUsers().catch(() => {})])
  refreshTimer = setInterval(loadDashboard, REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <section class="admin-page">
    <div class="admin-shell">
      <router-link to="/" class="back-link">
        <IconArrowLeft />
        Bibliothèque
      </router-link>

      <header class="admin-header">
        <h1 class="admin-title heading-display">Administration</h1>
        <p class="admin-subtitle">Tableau de bord du serveur, bibliothèque et comptes.</p>
      </header>

      <p v-if="dashboardError" class="message error" role="alert">{{ dashboardError }}</p>

      <div v-if="stats.length" class="stat-grid">
        <div v-for="stat in stats" :key="stat.label" class="stat-card">
          <p class="stat-value">{{ stat.value }}</p>
          <p class="stat-label">{{ stat.label }}</p>
        </div>
      </div>

      <section class="admin-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Bibliothèque</h2>
            <p class="card-desc">
              Le dossier média est surveillé en continu ; un scan manuel
              force la détection des ajouts, suppressions et métadonnées
              manquantes.
            </p>
            <p class="card-status">{{ lastScanLabel }}</p>
            <p v-if="dashboard?.scan.lastError" class="message error">
              {{ dashboard.scan.lastError }}
            </p>
          </div>
          <button
            class="primary-btn"
            :disabled="!dashboard || dashboard.scan.scanning"
            @click="startScan"
          >
            {{ dashboard?.scan.scanning ? 'Scan en cours…' : 'Scanner la bibliothèque' }}
          </button>
        </div>
      </section>

      <section class="admin-card">
        <h2 class="card-title">Activité</h2>
        <p class="card-desc">
          <template v-if="dashboard?.ffmpeg">ffmpeg {{ dashboard.ffmpeg }}</template>
          <template v-else-if="dashboard">
            ffmpeg introuvable : miniatures, remux et transcodage sont indisponibles.
          </template>
          <template v-if="dashboard"> · {{ dashboard.activeTranscodes }} conversion(s) en cours</template>
        </p>

        <p v-if="dashboard && dashboard.sessions.length === 0" class="empty">
          Personne ne regarde quoi que ce soit en ce moment.
        </p>
        <ul v-else-if="dashboard" class="session-list">
          <li
            v-for="session in dashboard.sessions"
            :key="`${session.userName}-${session.episodeId}`"
            class="session"
          >
            <div class="session-main">
              <p class="session-user">{{ session.userName }}</p>
              <p class="session-media">
                {{ session.animeName ?? 'Inconnu' }}
                <template v-if="session.episodeNumber"> · Ép. {{ session.episodeNumber }}</template>
              </p>
            </div>
            <div class="session-side">
              <span class="tag">{{ METHOD_LABELS[session.method] ?? session.method }}</span>
              <span class="session-time">
                {{ session.paused ? 'En pause' : 'Lecture' }} ·
                {{ formatPlaybackTime(session.position) }}
                <template v-if="session.duration"> / {{ formatPlaybackTime(session.duration) }}</template>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section class="admin-card">
        <h2 class="card-title">Utilisateurs</h2>
        <p class="card-desc">
          Il n'y a pas d'inscription publique : créez ici un compte par personne.
          Chacun a sa propre progression et ses favoris.
        </p>

        <ul class="user-list">
          <li v-for="user in users" :key="user.id" class="user">
            <div class="user-row">
              <div class="user-main">
                <p class="user-name">
                  {{ user.pseudo || user.email }}
                  <span v-if="user.isAdmin" class="tag tag-admin">Admin</span>
                  <span v-if="user.id === authStore.user?.id" class="tag">Vous</span>
                </p>
                <p class="user-email">{{ user.email }}</p>
              </div>
              <div class="user-actions">
                <button
                  class="ghost-btn"
                  :disabled="user.id === authStore.user?.id"
                  @click="toggleAdmin(user)"
                >
                  {{ user.isAdmin ? 'Retirer admin' : 'Rendre admin' }}
                </button>
                <button class="ghost-btn" @click="openReset(user)">Mot de passe</button>
                <button
                  class="ghost-btn danger"
                  :disabled="user.id === authStore.user?.id"
                  @click="deleteUserId = deleteUserId === user.id ? null : user.id; resetUserId = null"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <form v-if="resetUserId === user.id" class="inline-form" @submit.prevent="submitReset(user)">
              <input
                v-model="resetPassword"
                class="text-input"
                type="password"
                autocomplete="new-password"
                placeholder="Nouveau mot de passe"
                :aria-label="`Nouveau mot de passe pour ${user.email}`"
              />
              <button class="primary-btn" type="submit">Réinitialiser</button>
            </form>

            <div v-if="deleteUserId === user.id" class="inline-form">
              <p class="confirm-text">
                Supprimer {{ user.email }} ainsi que sa progression et ses favoris ?
              </p>
              <button class="primary-btn" @click="deleteUser(user)">Supprimer le compte</button>
              <button class="ghost-btn" @click="deleteUserId = null">Annuler</button>
            </div>
          </li>
        </ul>

        <form class="new-user" @submit.prevent="createUser">
          <h3 class="form-title">Nouveau compte</h3>
          <div class="form-grid">
            <label class="field">
              <span class="field-label">Email</span>
              <input
                v-model="newUser.email"
                class="text-input"
                type="email"
                autocomplete="off"
                required
              />
            </label>
            <label class="field">
              <span class="field-label">Pseudo</span>
              <input v-model="newUser.pseudo" class="text-input" type="text" autocomplete="off" />
            </label>
            <label class="field">
              <span class="field-label">Mot de passe</span>
              <input
                v-model="newUser.password"
                class="text-input"
                type="password"
                autocomplete="new-password"
                required
              />
            </label>
            <label class="checkbox">
              <input v-model="newUser.isAdmin" type="checkbox" />
              Administrateur
            </label>
          </div>
          <div class="form-footer">
            <button class="primary-btn" type="submit" :disabled="userBusy">Créer le compte</button>
            <p v-if="userMessage" class="message" :class="userMessage.kind" role="status">
              {{ userMessage.text }}
            </p>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  padding: 32px 28px 80px;
}
.admin-shell {
  max-width: 900px;
  margin: 0 auto;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--c-muted);
  text-decoration: none;
  margin-bottom: 28px;
  letter-spacing: .02em;
}
.back-link:hover { color: var(--c-text); }

.admin-header { margin-bottom: 28px; }
.admin-title {
  font-size: clamp(28px, 4vw, 42px);
  margin: 0 0 6px;
  letter-spacing: .04em;
}
.admin-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--c-muted);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  padding: 16px 18px;
}
.stat-value {
  margin: 0;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 28px;
  letter-spacing: .04em;
  color: var(--c-text);
}
.stat-label {
  margin: 2px 0 0;
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
}

.admin-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  padding: 22px 24px;
  margin-bottom: 16px;
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.card-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: .02em;
}
.card-desc {
  margin: 0;
  font-size: 13px;
  color: var(--c-muted);
  line-height: 1.5;
  max-width: 560px;
}
.card-status {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--c-text-soft);
}

.primary-btn {
  background: var(--c-accent);
  border: none;
  color: #fff;
  font-family: inherit;
  font-weight: 600;
  font-size: 13px;
  padding: 9px 18px;
  border-radius: 100px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.primary-btn:hover:not(:disabled) { filter: brightness(1.1); }
.primary-btn:disabled { opacity: .6; cursor: default; }

.ghost-btn {
  background: transparent;
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
  font-family: inherit;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 100px;
  cursor: pointer;
  white-space: nowrap;
}
.ghost-btn:hover:not(:disabled) { color: var(--c-text); border-color: var(--c-muted); }
.ghost-btn:disabled { opacity: .35; cursor: default; }
.ghost-btn.danger:hover:not(:disabled) { color: var(--c-accent); border-color: var(--c-accent); }

.empty {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--c-muted);
}

.session-list,
.user-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
}
.session,
.user {
  padding: 12px 0;
  border-top: 1px solid var(--c-border);
}
.session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.session-user,
.user-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.session-media,
.user-email {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--c-muted);
  overflow-wrap: anywhere;
}
.session-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.session-time {
  font-size: 12px;
  color: var(--c-text-soft);
  font-variant-numeric: tabular-nums;
}

.tag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 100px;
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
}
.tag-admin { color: var(--c-accent-2); border-color: var(--c-accent-2); }

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.user-main { min-width: 0; }
.user-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.inline-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.confirm-text {
  margin: 0;
  font-size: 13px;
  color: var(--c-text-soft);
}

.new-user {
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--c-border);
}
.form-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--c-text-soft);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field-label {
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
}
.text-input {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--c-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  min-width: 0;
  transition: border-color var(--t-fast);
}
.text-input:focus { border-color: var(--c-accent); }
.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--c-text-soft);
  cursor: pointer;
}
.checkbox input { accent-color: var(--c-accent); }
.form-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 16px;
}

.message { margin: 0; font-size: 13px; }
.message.ok { color: var(--c-airing); }
.message.error { color: var(--c-accent); }

@media (max-width: 700px) {
  .admin-page { padding: 20px 14px 60px; }
  .card-head { flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
