<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="auth-page">
    <div class="auth-card">
      <img class="auth-logo" src="/hedgehog.svg" alt="Hedgehog" />
      <h1 class="auth-title heading-display">Création de compte</h1>
      <p class="auth-subtitle">Bientôt disponible.</p>
      <button class="auth-back" @click="router.push('/sign-in')">
        Retour à la connexion
      </button>
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
.auth-logo { width: 56px; height: 56px; margin-bottom: 14px; }
.auth-title {
  font-size: 22px;
  margin: 0 0 4px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--c-text);
}
.auth-subtitle {
  font-size: 13px;
  color: var(--c-muted);
  margin: 0 0 24px;
}
.auth-back {
  background: var(--c-accent);
  border: none;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 10px 16px;
  border-radius: 100px;
  cursor: pointer;
  letter-spacing: .04em;
}
.auth-back:hover { filter: brightness(1.1); }
</style>
