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
  if (gigabytes >= 1024) return `${(gigabytes / 1024).toFixed(1)} To`
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
 * Format seconds as `m:ss` (or `h:mm:ss` past one hour), suitable for
 * video player timestamps. Negative or NaN inputs collapse to `0:00`.
 */
export function formatPlaybackTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const paddedSeconds = seconds.toString().padStart(2, '0')
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`
  return `${minutes}:${paddedSeconds}`
}

/** Format a runtime as "24 min" or "1 h 32", for episode lists. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds)) return ''
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${hours} h`
}

/**
 * Strip the trailing file extension from a filename ("Title.mkv" → "Title").
 * Returns the original string when no extension is present.
 */
export function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '')
}

/** Title to show for an episode: metadata title, else the bare filename. */
export function episodeTitle(episode: { title: string | null; name: string }): string {
  return episode.title ?? stripFileExtension(episode.name)
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

/** Human label for a video height ("1080p", "4K"). */
export function formatResolution(height: number | null | undefined): string {
  if (!height) return ''
  if (height >= 2000) return '4K'
  if (height >= 1400) return '1440p'
  if (height >= 1000) return '1080p'
  if (height >= 700) return '720p'
  if (height >= 460) return '480p'
  return `${height}p`
}
