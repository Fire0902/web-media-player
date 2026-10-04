<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/utils/authStore'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')

/** Submit the credentials to the API and redirect on success. */
async function login() {
  if (!email.value || !password.value) return
  await authStore.login(email.value, password.value)
  if (authStore.token) {
    // Return to the page that bounced the visitor here, if any.
    const redirect = route.query.redirect
    router.push(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/')
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <img class="auth-logo" src="/hedgehog.svg" alt="Hedgehog" />
      <h1 class="auth-title heading-display">Hedgehog</h1>
      <p class="auth-subtitle">Connectez-vous pour accéder à votre bibliothèque.</p>

      <form class="auth-form" @submit.prevent="login">
        <label class="auth-field">
          <span class="auth-label">Email</span>
          <input
            v-model="email"
            type="email"
            class="auth-input"
            placeholder="vous@exemple.com"
            autocomplete="username"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-label">Mot de passe</span>
          <input
            v-model="password"
            type="password"
            class="auth-input"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="authStore.error" class="auth-error">
          Identifiants invalides.
        </p>

        <button
          type="submit"
          class="auth-submit"
          :disabled="authStore.loading"
        >
          <span v-if="authStore.loading" class="auth-spinner" />
          <span v-else>Se connecter</span>
        </button>
      </form>

      <p class="auth-hint">
        Pas de compte ou mot de passe oublié ? Demandez à l'administrateur du serveur.
      </p>
    </div>
  </section>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(232, 56, 58, .12), transparent 60%),
    radial-gradient(900px 500px at 110% 110%, rgba(245, 166, 35, .08), transparent 60%),
    var(--c-bg);
}

.auth-card {
  width: 100%;
  max-width: 360px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  padding: 36px 32px 28px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .45);
  text-align: center;
}

.auth-logo {
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
}
.auth-title {
  font-size: 28px;
  margin: 0 0 4px;
  color: var(--c-text);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.auth-subtitle {
  font-size: 13px;
  color: var(--c-muted);
  margin: 0 0 24px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
}
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth-label {
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--c-muted);
}
.auth-input {
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--c-text);
  font-size: 14px;
  outline: none;
  transition: border-color var(--t-fast);
}
.auth-input:focus { border-color: var(--c-accent); }

.auth-error {
  margin: -4px 0 0;
  font-size: 12px;
  color: var(--c-accent);
}

.auth-submit {
  margin-top: 6px;
  background: var(--c-accent);
  border: none;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  padding: 11px 16px;
  border-radius: 100px;
  cursor: pointer;
  letter-spacing: .04em;
  transition: filter var(--t-fast), transform var(--t-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
}
.auth-submit:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.auth-submit:disabled { opacity: .7; cursor: default; }

.auth-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .3);
  border-top-color: #fff;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-hint {
  margin: 18px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--c-muted);
}
</style>
