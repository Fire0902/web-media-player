import { execa, type ResultPromise } from 'execa'
import { Readable } from 'stream'

/**
 * Real-time ffmpeg pipeline used whenever a file can't be served as-is.
 *
 * Three flavours, from cheapest to most expensive:
 *   - **remux** (`copyVideo`): the video stream is copied untouched and
 *     only the audio/container are converted. Used for MKV sources or
 *     when the user picks another audio track.
 *   - **transcode at source resolution**: the video codec isn't playable
 *     in a browser (HEVC, 10-bit H.264…) and is re-encoded to H.264.
 *   - **transcode to a target quality**: downscale to save bandwidth.
 *
 * Output is always fragmented MP4 written to stdout. Such a stream has
 * no random access: seeking is done by restarting ffmpeg with `-ss`,
 * and the player adds the offset back to its clock.
 *
 * Subtitles are never burned in; they are delivered separately by
 * `SubtitleService` and rendered client-side.
 */

export type TranscodeQuality = '360p' | '480p' | '720p' | '1080p'

export const QUALITY_HEIGHTS: Record<TranscodeQuality, number> = {
  '360p': 360,
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
}

const CRF_BY_QUALITY: Record<TranscodeQuality, number> = {
  '360p': 28,
  '480p': 26,
  '720p': 23,
  '1080p': 21,
}

const VIDEO_BITRATE_KBPS: Record<TranscodeQuality, number> = {
  '360p': 700,
  '480p': 1200,
  '720p': 2500,
  '1080p': 4500,
}

export interface TranscodeOptions {
  /** Absolute path of the source video on disk. */
  inputPath: string
  /** Target quality, or null to keep the source resolution. */
  quality: TranscodeQuality | null
  /** Copy the video stream instead of re-encoding (ignored with a quality). */
  copyVideo?: boolean
  /** Audio track to keep (position among the audio streams). */
  audioIndex?: number
  /**
   * Seek offset in seconds. Used when the client jumps in the
   * timeline — ffmpeg restarts from that point with `-ss`.
   */
  startSeconds?: number
}

export interface TranscodeHandle {
  /** Pipe this into the HTTP response. */
  stream: Readable
  /** Kill the ffmpeg child process when the response closes. */
  abort: () => void
}

/** Number of ffmpeg processes currently feeding a client. */
let activeTranscodes = 0

export function getActiveTranscodeCount(): number {
  return activeTranscodes
}

export class TranscodeService {
  /**
   * Spawn an ffmpeg process and return its stdout as a readable stream.
   * The caller is responsible for cleaning up via `abort()` when the
   * client disconnects, otherwise the encoder keeps running.
   */
  start({
    inputPath,
    quality,
    copyVideo = false,
    audioIndex = 0,
    startSeconds = 0,
  }: TranscodeOptions): TranscodeHandle {
    const args: string[] = ['-hide_banner', '-loglevel', 'error']

    // `-ss` before `-i` seeks on the input: instant, and frame-accurate
    // when re-encoding. With a copied video stream the output starts on
    // the previous keyframe (see `MediaInfoService.keyframeBefore`).
    if (startSeconds > 0) {
      args.push('-ss', String(startSeconds))
    }

    args.push(
      '-i', inputPath,
      '-map', '0:v:0',
      // Trailing `?` keeps ffmpeg happy on files without (that) audio.
      '-map', `0:a:${audioIndex}?`,
      '-sn',
      '-dn',
    )

    if (!quality && copyVideo) {
      args.push('-c:v', 'copy')
    } else {
      const crf = quality ? CRF_BY_QUALITY[quality] : 21
      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', String(crf),
        // 8-bit 4:2:0 so 10-bit sources remain playable everywhere.
        '-pix_fmt', 'yuv420p',
        // A keyframe every ~2s keeps the MP4 fragments short.
        '-g', '48',
      )
      if (quality) {
        const height = QUALITY_HEIGHTS[quality]
        const bitrate = VIDEO_BITRATE_KBPS[quality]
        args.push(
          // Downscale only: never blow a 480p source up to 1080p.
          '-vf', `scale=-2:'min(${height},ih)'`,
          '-maxrate', `${bitrate}k`,
          '-bufsize', `${bitrate * 2}k`,
        )
      }
    }

    args.push(
      // Audio: AAC LC stereo, what every browser decodes.
      '-c:a', 'aac',
      '-ac', '2',
      '-b:a', '160k',
      // Fragmented MP4: written progressively, playable as it arrives.
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    )

    const child: ResultPromise = execa('ffmpeg', args, {
      stdout: 'pipe',
      stderr: 'pipe',
      buffer: false,
    })

    activeTranscodes++
    let finished = false
    const release = () => {
      if (finished) return
      finished = true
      activeTranscodes--
    }

    child.then(release, (err) => {
      release()
      // Being killed because the viewer left is the normal way out.
      if (err.isCanceled || err.isTerminated || err.signal) return
      console.error('[TranscodeService] ffmpeg failed:', err.shortMessage ?? err.message)
    })

    return {
      stream: child.stdout as Readable,
      abort: () => {
        try {
          child.kill('SIGTERM')
        } catch {
          /* already dead */
        }
      },
    }
  }
}
