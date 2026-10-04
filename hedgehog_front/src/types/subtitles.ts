/**
 * Subtitle track metadata returned by the API.
 * `id` is an opaque server-side identifier; the frontend uses it
 * verbatim when requesting the track payload.
 */
export interface SubtitleTrack {
  id: string
  label: string
  format: 'ass' | 'ssa' | 'srt' | 'vtt' | 'sub'
  /** Sidecar file next to the video, or track muxed in the container. */
  source: 'external' | 'embedded'
}
