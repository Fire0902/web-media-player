import { defineStore } from 'pinia'
import api, { setToken } from '@/utils/api'

export interface User {
  id: number
  pseudo: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: Error | null
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
  }),

  actions: {
    /** Exchange credentials for a bearer token; updates store + HTTP client. */
    async login(email: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post<{ token: string; user: User }>(
          '/auth',
          { email, password },
        )
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

    /** Clear the in-memory and persisted session. */
    logout() {
      this.token = null
      this.user = null
      setToken('')
    },
  },
})
