const BASE_URL = 'http://localhost:3333'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions extends RequestInit {
  headers?: HeadersInit
}

let bearerToken: string | null = localStorage.getItem('token') || null

export function setToken(token: string) {
  bearerToken = token
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions & { method: HttpMethod }
): Promise<T> {
  const headers: Record<string, any> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(errorBody || `HTTP error ${response.status}`)
  }

  if (response.status === 204) return null as T

  return response.json() as Promise<T>
}

export default {
  async get<T>(endpoint: string, options: RequestOptions = {}) {
    return request<T>(endpoint, {
      ...options,
      method: 'GET'
    }).then(data => ({ data }))
  },

  async post<T>(endpoint: string, body: unknown, options: RequestOptions = {}) {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    }).then(data => ({ data }))
  },

  async put<T>(endpoint: string, body: unknown, options: RequestOptions = {}) {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    }).then(data => ({ data }))
  },

  async delete<T>(endpoint: string, options: RequestOptions = {}) {
    return request<T>(endpoint, {
      ...options,
      method: 'DELETE'
    }).then(data => ({ data }))
  }
}
