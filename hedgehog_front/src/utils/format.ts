/**
 * Pure formatting helpers shared across the UI.
 * Kept side-effect free so they can be reused inside computed properties.
 */

/**
 * Convert a byte count to a human readable string in French units.
 * Anything past 1 Go switches from megabytes to gigabytes.
 */
export function formatFileSize(bytes: number): string {
  const gigabytes = bytes / 1024 / 1024 / 1024
  if (gigabytes >= 1) return `${gigabytes.toFixed(1)} Go`
  return `${(bytes / 1024 / 1024).toFixed(0)} Mo`
}

/**
 * Format an ISO date in French long form, e.g. "5 mars 2024".
 * `short` switches the month to its abbreviated form.
 */
export function formatAirDate(isoDate: string, short = false): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    year: 'numeric',
  })
}

/**
 * Format seconds as `m:ss`, suitable for video player timestamps.
 * Negative or NaN inputs collapse to `0:00`.
 */
export function formatPlaybackTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Strip the trailing file extension from a filename ("Title.mkv" → "Title").
 * Returns the original string when no extension is present.
 */
export function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

/**
 * Render an episode number with leading zero, or `??` when unknown.
 * `mode === 'absolute'` falls back to season-relative when no absolute exists.
 */
export function formatEpisodeNumber(
  episode: { episodeNumber: number | null; episodeNumberAbsolute: number | null },
  mode: 'season' | 'absolute',
): string {
  const value =
    mode === 'season'
      ? episode.episodeNumber
      : episode.episodeNumberAbsolute ?? episode.episodeNumber
  return value != null ? String(value).padStart(2, '0') : '??'
}
