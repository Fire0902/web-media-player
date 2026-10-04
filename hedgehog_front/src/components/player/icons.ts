/**
 * SVG path data used by the video player icons.
 * Keeping these as constants lets the consuming components stay readable
 * (no inline raw paths) and avoids creating a Vue component per glyph.
 */
export const PLAY_PATH = 'M8 5v14l11-7z'
export const PAUSE_PATH = 'M6 19h4V5H6zm8-14v14h4V5z'
export const PREV_PATH = 'M6 6h2v12H6zm3.5 6 8.5 6V6z'
export const NEXT_PATH = 'M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8zM16 6h2v12h-2z'
export const SEEK_LEFT_PATH = 'M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z'
export const SEEK_RIGHT_PATH = 'M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z'
export const FULLSCREEN_ENTER_PATH =
  'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'
export const FULLSCREEN_EXIT_PATH =
  'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'
export const VOLUME_MUTE_PATH =
  'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'
export const VOLUME_LOW_PATH =
  'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z'
export const VOLUME_HIGH_PATH =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'
export const PIP_PATH =
  'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z'
export const CHECK_PATH = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
export const HEART_PATH =
  'm12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
