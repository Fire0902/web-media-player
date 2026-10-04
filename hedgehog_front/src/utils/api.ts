/**
 * Tiny `fetch` wrapper used as the project's HTTP client.
 *
 * Responsibilities:
 *   - inject the bearer token saved in localStorage on every request;
 *   - parse JSON responses (or surface plain text errors);
 *   - expose familiar `get` / `post` / `put` / `delete` helpers returning
 *     `{ data }`, so callers can destructure without ceremony.
 */

import { API_BASE_URL } from '@/config'

export const BASE_URL = API_BASE_URL

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions extends RequestInit {
  headers?: HeadersInit
}

/** Error thrown for non-2xx responses, carrying the HTTP status. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const TOKEN_STORAGE_KEY = 'token'
let bearerToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY)
let unauthorizedHandler: (() => void) | null = null

/** Update the in-memory token and mirror it to localStorage. */
export function setToken(token: string) {
  bearerToken = token || null
  if (bearerToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, bearerToken)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

/**
 * Register what happens when the API rejects our token (expired or
 * revoked session). The router uses it to send the user to sign-in.
 */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

/** Pull a readable message out of an error body (`{ error }`, Adonis `{ errors }`, text). */
function extractMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed?.error === 'string') return parsed.error
    if (typeof parsed?.message === 'string') return parsed.message
    if (Array.isArray(parsed?.errors) && parsed.errors[0]?.message) {
      return String(parsed.errors[0].message)
    }
  } catch {
    /* not JSON */
  }
  return body || `HTTP error ${status}`
}

/**
 * Low-level request handler. Throws an `ApiError` whose message is the
 * server-provided reason for non-2xx responses, otherwise returns the
 * parsed JSON payload. `204 No Content` is normalised to `null`.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions & { method: HttpMethod },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  const hadToken = Boolean(bearerToken)
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers })

  if (!response.ok) {
    const errorBody = await response.text()
    // A 401 on the login form is just a wrong password, not a dead session.
    if (response.status === 401 && hadToken) unauthorizedHandler?.()
    throw new ApiError(extractMessage(errorBody, response.status), response.status)
  }

  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

export default {
  /** GET request returning `{ data }`. */
  async get<T>(endpoint: string, options: RequestOptions = {}) {
    const data = await request<T>(endpoint, { ...options, method: 'GET' })
    return { data }
  },

  /** POST request, body is JSON-encoded automatically. */
  async post<T>(endpoint: string, body: unknown, options: RequestOptions = {}) {
    const data = await request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    })
    return { data }
  },

  /** PUT request, body is JSON-encoded automatically. */
  async put<T>(endpoint: string, body: unknown, options: RequestOptions = {}) {
    const data = await request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return { data }
  },

  /** DELETE request. */
  async delete<T>(endpoint: string, options: RequestOptions = {}) {
    const data = await request<T>(endpoint, { ...options, method: 'DELETE' })
    return { data }
  },
}
