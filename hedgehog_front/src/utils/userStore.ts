import { defineStore } from 'pinia'
import api from '@/utils/api'

export interface User {
  id: number
  pseudo: string
  email: string
}

interface State {
  users: User[]
  loading: boolean
  error: Error | null
}

export const useUserStore = defineStore('users', {
  state: (): State => ({
    users: [],
    loading: false,
    error: null
  }),

  actions: {
    async getAll() {
      this.loading = true
      this.error = null

      try {
        const { data } = await api.get<User[]>('/users')
        this.users = data
      } catch (e: any) {
        this.error = e
      } finally {
        this.loading = false
      }
    },
  }
})
