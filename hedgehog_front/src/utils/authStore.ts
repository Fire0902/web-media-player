import { defineStore } from 'pinia'
import api, { setToken } from '@/utils/api'

export interface User {
  id: number
  pseudo: string | null
  email: string
  isAdmin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: Error | null
  /** Whether the instance still needs an initial admin to be created. */
  needsSetup: boolean | null
}

interface TokenResponse {
  token: string
  user: User
}

/**
 * Authentication store: holds the current bearer token, the matching user
 * profile and the loading/error flags used by the sign-in form.
 *
 * The token is also mirrored to the HTTP layer through `setToken` so that
 * every subsequent request carries the `Authorization` header.
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null,
    needsSetup: null,
  }),

  getters: {
    isAdmin: (state): boolean => Boolean(state.user?.isAdmin),
    /** Name shown in the navbar: pseudo when set, email otherwise. */
    displayName: (state): string => state.user?.pseudo || state.user?.email || '',
  },

  actions: {
    /**
     * Ask the backend whether a first-time setup is still required.
     * Cached in state once resolved so the router guard can read it
     * synchronously on subsequent navigations.
     */
    async checkSetup(): Promise<boolean> {
      try {
        const { data } = await api.get<{ needsSetup: boolean }>('/setup')
        this.needsSetup = Boolean(data.needsSetup)
      } catch {
        // Treat backend errors as "setup not required" so the user lands
        // on the sign-in screen and can see the real error from there.
        this.needsSetup = false
      }
      return this.needsSetup
    },

    /** Create the first administrator and log them in. */
    async setup(email: string, pseudo: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post<TokenResponse>('/setup', { email, pseudo, password })
        this.token = data.token
        this.user = data.user
        this.needsSetup = false
        setToken(data.token)
      } catch (err: any) {
        this.error = err
      } finally {
        this.loading = false
      }
    },

    /** Exchange credentials for a bearer token; updates store + HTTP client. */
    async login(email: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post<TokenResponse>('/auth', { email, password })
        this.token = data.token
        this.user = data.user
        setToken(data.token)
      } catch (err: any) {
        this.error = err
        this.token = null
        this.user = null
      } finally {
        this.loading = false
      }
    },

    /**
     * Load the profile behind a token restored from localStorage.
     * Returns false when the token is no longer valid.
     */
    async fetchUser(): Promise<boolean> {
      if (!this.token) return false
      try {
        const { data } = await api.get<User>('/me')
        this.user = data
        return true
      } catch {
        return false
      }
    },

    /** Update the signed-in user's display name and/or password. */
    async updateProfile(payload: { pseudo?: string; currentPassword?: string; password?: string }) {
      const { data } = await api.put<User>('/me', payload)
      this.user = data
    },

    /** Forget the session locally (token already invalid or revoked). */
    clearSession() {
      this.token = null
      this.user = null
      setToken('')
    },

    /** Revoke the token server-side, then clear the local session. */
    async logout() {
      try {
        if (this.token) await api.delete('/auth')
      } catch {
        /* token already dead: nothing to revoke */
      }
      this.clearSession()
    },
  },
})
