import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'
import app from '@adonisjs/core/services/app'
import type { MediaInfo } from '#services/media_info_service'

/**
 * Discover and serve subtitles for a video file. Two sources:
 *
 * **Sidecar files** sitting next to the video:
 *   1. Same basename as the video, any subtitle extension
 *      (`MyEpisode.mkv` → `MyEpisode.ass`)
 *   2. Same basename + language tag
 *      (`MyEpisode.mkv` → `MyEpisode.fr.srt`, `MyEpisode.en.vtt`)
 *
 * **Embedded tracks** muxed inside the container (typical for MKV).
 * Text-based ones are extracted with ffmpeg on first use and cached on
 * disk; bitmap formats (PGS, VobSub) are skipped.
 *
 * Sidecars are always read from the filesystem so a newly dropped file
 * shows up without restarting the server.
 */

export interface SubtitleTrack {
  /** Stable identifier used in URLs. */
  id: string
  /** Display label, e.g. "fr" / "en" / "default". */
  label: string
  /** Format delivered to the player. */
  format: 'ass' | 'ssa' | 'srt' | 'vtt' | 'sub'
  /** Where the track comes from. */
  source: 'external' | 'embedded'
  /** Absolute path on disk (sidecars only). */
  filePath: string | null
  /** Position among the subtitle streams (embedded only). */
  streamIndex: number | null
}

const SUBTITLE_EXTENSIONS = ['.ass', '.ssa', '.srt', '.vtt', '.sub'] as const
const EMBEDDED_PREFIX = 'emb-'

export class SubtitleService {
  private get cacheDir() {
    return app.makePath('tmp/subtitles')
  }

  /**
   * Locate every subtitle available for a given video file: sidecars
   * first, then the text tracks embedded in the container.
   */
  async listForVideo(videoPath: string, info?: MediaInfo | null): Promise<SubtitleTrack[]> {
    const dir = path.dirname(videoPath)
    const baseName = path.basename(videoPath, path.extname(videoPath))

    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      /* unreadable folder: fall through with embedded tracks only */
    }

    const tracks: SubtitleTrack[] = []
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase()
      if (!SUBTITLE_EXTENSIONS.includes(ext as (typeof SUBTITLE_EXTENSIONS)[number])) {
        continue
      }
      const entryBase = path.basename(entry, ext)
      // Accept exact match or `<basename>.<lang>` prefix.
      if (entryBase !== baseName && !entryBase.startsWith(`${baseName}.`)) continue

      const lang = entryBase === baseName ? 'default' : entryBase.slice(baseName.length + 1)
      tracks.push({
        id: this.makeTrackId(entry),
        label: lang || 'default',
        format: ext.slice(1) as SubtitleTrack['format'],
        source: 'external',
        filePath: path.join(dir, entry),
        streamIndex: null,
      })
    }
    tracks.sort((a, b) => a.label.localeCompare(b.label))

    for (const stream of info?.subtitles ?? []) {
      if (!stream.textBased) continue
      const isAss = stream.codec === 'ass' || stream.codec === 'ssa'
      const name = [stream.language, stream.title].filter(Boolean).join(' · ')
      tracks.push({
        id: `${EMBEDDED_PREFIX}${stream.index}`,
        label: name || `Piste ${stream.index + 1}`,
        format: isAss ? 'ass' : 'vtt',
        source: 'embedded',
        filePath: null,
        streamIndex: stream.index,
      })
    }

    return tracks
  }

  /** Find a track from the identifier carried in the URL. */
  findTrack(tracks: SubtitleTrack[], trackId: string): SubtitleTrack | null {
    if (trackId.startsWith(EMBEDDED_PREFIX)) {
      return tracks.find((t) => t.id === trackId) ?? null
    }
    const wantedFilename = this.decodeTrackId(trackId)
    return (
      tracks.find((t) => t.filePath !== null && path.basename(t.filePath) === wantedFilename) ??
      null
    )
  }

  /**
   * Return a subtitle payload ready for the player. SRT/SUB are
   * converted to VTT so the browser's native `<track>` element can
   * render them; ASS/SSA are passed through and rendered by JASSUB.
   *
   * `offsetSeconds` shifts VTT cues backwards: a transcoded stream that
   * started mid-episode restarts its clock at zero.
   */
  async readTrack(
    track: SubtitleTrack,
    videoPath: string,
    cacheKey: string,
    offsetSeconds = 0
  ): Promise<{ body: string; mime: string }> {
    const raw =
      track.source === 'embedded'
        ? await this.extractEmbedded(track, videoPath, cacheKey)
        : await fs.readFile(track.filePath!, 'utf-8')

    if (track.format === 'ass' || track.format === 'ssa') {
      // JASSUB applies the time offset itself.
      return { body: raw, mime: 'text/plain; charset=utf-8' }
    }

    const vtt = track.format === 'vtt' ? raw : srtToVtt(raw)
    return {
      body: offsetSeconds > 0 ? shiftVtt(vtt, offsetSeconds) : vtt,
      mime: 'text/vtt; charset=utf-8',
    }
  }

  /**
   * Pull an embedded track out of the container. Extraction reads the
   * whole file, so the result is cached under `tmp/subtitles`.
   */
  private async extractEmbedded(
    track: SubtitleTrack,
    videoPath: string,
    cacheKey: string
  ): Promise<string> {
    const format = track.format === 'ass' ? 'ass' : 'webvtt'
    const cached = path.join(this.cacheDir, `${cacheKey}-${track.streamIndex}.${format}`)

    try {
      return await fs.readFile(cached, 'utf-8')
    } catch {
      /* not extracted yet */
    }

    const { stdout } = await execa(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', videoPath,
        '-map', `0:s:${track.streamIndex}`,
        '-f', format,
        'pipe:1',
      ],
      { stripFinalNewline: false, maxBuffer: 64 * 1024 * 1024 }
    )

    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.writeFile(cached, stdout, 'utf-8')
    return stdout
  }

  /**
   * Derive a URL-safe identifier from a sidecar filename so the frontend
   * can address it without exposing the full filesystem path.
   */
  private makeTrackId(filename: string): string {
    return Buffer.from(filename, 'utf-8').toString('base64url')
  }

  /** Resolve a track id back to its filename within the video's folder. */
  decodeTrackId(id: string): string {
    return Buffer.from(id, 'base64url').toString('utf-8')
  }
}

/**
 * Minimal SRT → WebVTT converter. Replaces the comma separator in
 * timestamps and prepends the WEBVTT header. Styling cues are dropped;
 * for richer rendering use ASS sidecars and JASSUB.
 */
function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^﻿/, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return `WEBVTT\n\n${body.trim()}\n`
}

const VTT_TIMESTAMP = /(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})/g

/** Move every cue `offsetSeconds` earlier, clamping at zero. */
function shiftVtt(vtt: string, offsetSeconds: number): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const format = (total: number) => {
    const ms = Math.max(0, Math.round(total * 1000))
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`
  }

  return vtt
    .split('\n')
    .map((line) => {
      if (!line.includes('-->')) return line
      return line.replace(VTT_TIMESTAMP, (_match, h, m, s, ms) => {
        const seconds = Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
        return format(seconds - offsetSeconds)
      })
    })
    .join('\n')
}
