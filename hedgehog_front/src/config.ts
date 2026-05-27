/**
 * Runtime configuration resolved from Vite's build-time env vars.
 * Set `VITE_API_BASE_URL` to override the default API endpoint
 * (handy for Docker prod where the frontend talks to the backend
 * through nginx and uses a same-origin relative path).
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3333'
