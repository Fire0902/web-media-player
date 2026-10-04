<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/utils/authStore'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const pseudo = ref('')
const password = ref('')
const passwordConfirm = ref('')
const localError = ref<string | null>(null)

const passwordsMatch = computed(
  () => password.value === passwordConfirm.value,
)

/**
 * Validate the form locally, create the first administrator and
 * redirect to the library on success.
 */
async function submit() {
  localError.value = null

  if (password.value.length < 8) {
    localError.value = 'Le mot de passe doit faire au moins 8 caractères.'
    return
  }
  if (!passwordsMatch.value) {
    localError.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  await authStore.setup(email.value, pseudo.value, password.value)
  if (authStore.token) {
    router.push('/')
  }
}

onMounted(async () => {
  // Bounce back to sign-in if a user already exists (e.g. someone shared
  // the URL but the instance was already initialized).
  if (authStore.needsSetup === null) {
    await authStore.checkSetup()
  }
  if (authStore.needsSetup === false) {
    router.replace('/sign-in')
  }
})
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <img class="auth-logo" src="/hedgehog.svg" alt="Hedgehog" />
      <h1 class="auth-title heading-display">Initialisation</h1>
      <p class="auth-subtitle">
        Premier démarrage. Créez le compte administrateur de l'instance.
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="auth-field">
          <span class="auth-label">Email</span>
          <input
            v-model="email"
            type="email"
            class="auth-input"
            placeholder="admin@exemple.com"
            autocomplete="username"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-label">Pseudo</span>
          <input
            v-model="pseudo"
            type="text"
            class="auth-input"
            placeholder="admin"
            autocomplete="nickname"
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
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-label">Confirmation</span>
          <input
            v-model="passwordConfirm"
            type="password"
            class="auth-input"
            placeholder="••••••••"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>

        <p v-if="localError" class="auth-error">{{ localError }}</p>
        <p v-else-if="authStore.error" class="auth-error">
          Impossible de créer le compte. Vérifiez vos informations.
        </p>

        <button
          type="submit"
          class="auth-submit"
          :disabled="authStore.loading"
        >
          <span v-if="authStore.loading" class="auth-spinner" />
          <span v-else>Créer le compte</span>
        </button>
      </form>
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
  max-width: 380px;
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
  font-size: 26px;
  margin: 0 0 4px;
  color: var(--c-text);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.auth-subtitle {
  font-size: 13px;
  color: var(--c-muted);
  margin: 0 0 24px;
  line-height: 1.45;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  margin: 0;
  font-size: 12px;
  color: var(--c-accent);
}

.auth-submit {
  margin-top: 10px;
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
</style>
