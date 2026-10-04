<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  STREAM_QUALITIES,
  useSettingsStore,
  type StreamQuality,
} from '@/utils/settingsStore'
import { useAuthStore } from '@/utils/authStore'
import IconArrowLeft from '@/components/ui/IconArrowLeft.vue'

const settings = useSettingsStore()
const authStore = useAuthStore()

/** Qualities offered when transcoding is enabled (excludes `source`). */
const downscaleQualities = computed<StreamQuality[]>(() =>
  STREAM_QUALITIES.filter((quality) => quality !== 'source'),
)

function describe(quality: StreamQuality): string {
  switch (quality) {
    case '360p': return 'Très basse — ~0.7 Mbps'
    case '480p': return 'Basse — ~1.2 Mbps'
    case '720p': return 'Standard HD — ~2.5 Mbps'
    case '1080p': return 'Full HD — ~4.5 Mbps'
    case 'source': return 'Pas de réduction'
  }
}

// ── Account ────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8

const pseudo = ref(authStore.user?.pseudo ?? '')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const accountBusy = ref(false)
const accountMessage = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

/** Save the display name and, when filled in, the new password. */
async function saveAccount() {
  accountMessage.value = null

  const changingPassword = newPassword.value !== ''
  if (changingPassword) {
    if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
      accountMessage.value = {
        kind: 'error',
        text: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
      }
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      accountMessage.value = { kind: 'error', text: 'Les mots de passe ne correspondent pas.' }
      return
    }
  }

  accountBusy.value = true
  try {
    await authStore.updateProfile({
      pseudo: pseudo.value,
      ...(changingPassword
        ? { currentPassword: currentPassword.value, password: newPassword.value }
        : {}),
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    accountMessage.value = { kind: 'ok', text: 'Compte mis à jour.' }
  } catch (err: any) {
    accountMessage.value = { kind: 'error', text: err?.message ?? 'Échec de la mise à jour.' }
  } finally {
    accountBusy.value = false
  }
}
</script>

<template>
  <section class="settings-page">
    <div class="settings-shell">
      <router-link to="/" class="back-link">
        <IconArrowLeft />
        Bibliothèque
      </router-link>

      <header class="settings-header">
        <h1 class="settings-title heading-display">Paramètres</h1>
        <p class="settings-subtitle">
          Les réglages de lecture sont conservés dans ce navigateur uniquement.
        </p>
      </header>

      <section class="settings-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Lecture automatique</h2>
            <p class="card-desc">
              Enchaîne sur l'épisode suivant à la fin de chaque épisode,
              après un court compte à rebours.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              aria-label="Lecture automatique de l'épisode suivant"
              :checked="settings.autoplayNext"
              @change="settings.setAutoplayNext(
                ($event.target as HTMLInputElement).checked,
              )"
            />
            <span class="switch-slider" />
          </label>
        </div>
      </section>

      <section class="settings-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Limiter la qualité</h2>
            <p class="card-desc">
              Ré-encode la vidéo à la volée côté serveur pour réduire la
              bande passante. Désactivé, chaque fichier est lu tel quel
              quand le navigateur le permet, et converti automatiquement
              sinon.
            </p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              aria-label="Limiter la qualité"
              :checked="settings.transcodingEnabled"
              @change="settings.setTranscodingEnabled(
                ($event.target as HTMLInputElement).checked,
              )"
            />
            <span class="switch-slider" />
          </label>
        </div>

        <div v-if="settings.transcodingEnabled" class="quality-list">
          <p class="quality-label">Qualité cible</p>
          <div class="quality-options">
            <button
              v-for="quality in downscaleQualities"
              :key="quality"
              class="quality-option"
              :class="{ active: settings.quality === quality }"
              @click="settings.setQuality(quality)"
            >
              <span class="quality-name">{{ quality }}</span>
              <span class="quality-desc">{{ describe(quality) }}</span>
            </button>

            <button
              class="quality-option"
              :class="{ active: settings.quality === 'source' }"
              @click="settings.setQuality('source')"
            >
              <span class="quality-name">Source</span>
              <span class="quality-desc">{{ describe('source') }}</span>
            </button>
          </div>
          <p class="quality-warning">
            Le ré-encodage consomme du CPU côté serveur. La qualité se
            change aussi directement depuis le lecteur.
          </p>
        </div>
      </section>

      <section class="settings-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Sous-titres</h2>
            <p class="card-desc">
              Langue chargée par défaut (si présente). Laisser vide pour
              démarrer sans sous-titres.
            </p>
          </div>
          <input
            class="text-input"
            type="text"
            aria-label="Langue des sous-titres par défaut"
            :value="settings.preferredSubtitleLabel"
            placeholder="ex. fr, fre, en"
            @input="settings.setPreferredSubtitle(
              ($event.target as HTMLInputElement).value,
            )"
          />
        </div>
      </section>

      <section class="settings-card">
        <div class="card-head">
          <div>
            <h2 class="card-title">Piste audio</h2>
            <p class="card-desc">
              Langue audio préférée pour les fichiers multi-pistes.
              Laisser vide pour garder la piste par défaut du fichier.
            </p>
          </div>
          <input
            class="text-input"
            type="text"
            aria-label="Langue audio préférée"
            :value="settings.preferredAudioLanguage"
            placeholder="ex. jpn, fre, eng"
            @input="settings.setPreferredAudioLanguage(
              ($event.target as HTMLInputElement).value,
            )"
          />
        </div>
      </section>

      <section v-if="authStore.user" class="settings-card">
        <h2 class="card-title">Compte</h2>
        <p class="card-desc">{{ authStore.user.email }}</p>

        <form class="account-form" @submit.prevent="saveAccount">
          <label class="field">
            <span class="field-label">Pseudo</span>
            <input v-model="pseudo" class="text-input" type="text" autocomplete="nickname" />
          </label>
          <label class="field">
            <span class="field-label">Mot de passe actuel</span>
            <input
              v-model="currentPassword"
              class="text-input"
              type="password"
              autocomplete="current-password"
            />
          </label>
          <label class="field">
            <span class="field-label">Nouveau mot de passe</span>
            <input
              v-model="newPassword"
              class="text-input"
              type="password"
              autocomplete="new-password"
            />
          </label>
          <label class="field">
            <span class="field-label">Confirmation</span>
            <input
              v-model="confirmPassword"
              class="text-input"
              type="password"
              autocomplete="new-password"
            />
          </label>

          <div class="account-footer">
            <button class="save-btn" type="submit" :disabled="accountBusy">Enregistrer</button>
            <p
              v-if="accountMessage"
              class="account-message"
              :class="accountMessage.kind"
              role="status"
            >
              {{ accountMessage.text }}
            </p>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  padding: 32px 28px 80px;
}
.settings-shell {
  max-width: 760px;
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

.settings-header {
  margin-bottom: 32px;
}
.settings-title {
  font-size: clamp(28px, 4vw, 42px);
  margin: 0 0 6px;
  letter-spacing: .04em;
}
.settings-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--c-muted);
}

.settings-card {
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
  color: var(--c-text);
  letter-spacing: .02em;
}
.card-desc {
  margin: 0;
  font-size: 13px;
  color: var(--c-muted);
  line-height: 1.5;
  max-width: 480px;
}

/* iOS-style toggle */
.switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-slider {
  position: absolute;
  inset: 0;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 100px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.switch-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--c-muted);
  transition: transform var(--t-base), background var(--t-fast);
}
.switch input:checked + .switch-slider {
  background: var(--c-accent);
  border-color: var(--c-accent);
}
.switch input:checked + .switch-slider::before {
  transform: translateX(20px);
  background: #fff;
}
.switch input:focus-visible + .switch-slider {
  outline: 2px solid var(--c-text);
  outline-offset: 2px;
}

.quality-list {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--c-border);
}
.quality-label {
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
  margin: 0 0 10px;
}
.quality-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
}
.quality-option {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  color: var(--c-text);
  transition: border-color var(--t-fast), background var(--t-fast);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.quality-option:hover {
  border-color: var(--c-border-strong);
}
.quality-option.active {
  border-color: var(--c-accent);
  background: rgba(232, 56, 58, .08);
}
.quality-name {
  font-weight: 600;
  letter-spacing: .04em;
}
.quality-desc {
  font-size: 11px;
  color: var(--c-muted);
}
.quality-warning {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--c-muted);
  font-style: italic;
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
  min-width: 160px;
  transition: border-color var(--t-fast);
}
.text-input:focus { border-color: var(--c-accent); }

.account-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field .text-input { min-width: 0; }
.field-label {
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
}
.account-footer {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.save-btn {
  background: var(--c-accent);
  border: none;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 9px 18px;
  border-radius: 100px;
  cursor: pointer;
}
.save-btn:hover:not(:disabled) { filter: brightness(1.1); }
.save-btn:disabled { opacity: .6; cursor: default; }
.account-message { margin: 0; font-size: 13px; }
.account-message.ok { color: var(--c-airing); }
.account-message.error { color: var(--c-accent); }

@media (max-width: 600px) {
  .settings-page { padding: 20px 14px 60px; }
  .card-head { flex-direction: column; }
  .account-form { grid-template-columns: 1fr; }
}
</style>
