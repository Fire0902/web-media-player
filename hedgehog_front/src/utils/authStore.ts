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

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null
  }),

  actions: {
    async login(email: string, password: string) {
      this.loading = true
      this.error = null

      try {
        const { data } = await api.post<{ token: string, user: User }>('/auth', { email, password })

        this.token = data.token
        this.user = data.user

        localStorage.setItem('token', data.token)
        setToken(data.token)

      } catch (e: any) {
        this.error = e
        this.token = null
        this.user = null
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      setToken('')
    }
  }
})
