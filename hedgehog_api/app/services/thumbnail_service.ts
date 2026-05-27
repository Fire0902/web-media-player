import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'
import app from '@adonisjs/core/services/app'

export class ThumbnailService {
  /**
   * Output directory for thumbnails.
   * Served statically by AdonisJS at /thumbnails/<filename>.jpg
   */
  private get thumbnailDir() {
    return app.makePath('public/thumbnails')
  }

  /**
   * Generates a thumbnail for an episode if it does not already exist.
   *
   * @param episodePath   Absolute path to the video file
   * @param episodeId     Episode ID in the database (used as the filename)
   * @param offsetSeconds When to capture the frame (default: 5 minutes)
   * @returns             Relative public path of the thumbnail, e.g. "/thumbnails/42.jpg"
   *                      or null if ffmpeg fails
   */
  async generate(
    episodePath: string,
    episodeId: number,
    offsetSeconds = 300
  ): Promise<string | null> {
    await this.ensureDir()

    const outputFile = path.join(this.thumbnailDir, `${episodeId}.jpg`)

    if (await this.exists(outputFile)) {
      return `/thumbnails/${episodeId}.jpg`
    }

    const timestamp = new Date(offsetSeconds * 1000).toISOString().substring(11, 19)

    try {
      console.log(`[Thumbnail] génération épisode #${episodeId} (offset ${timestamp})`)

      await execa('ffmpeg', [
        '-ss', timestamp,
        '-i', episodePath,
        '-vframes', '1',
        '-q:v', '3',
        '-vf', 'scale=320:-1',
        '-y',
        outputFile,
      ])

      console.log(`[Thumbnail] ✓ épisode #${episodeId} → ${outputFile}`)
      return `/thumbnails/${episodeId}.jpg`
    } catch (e: any) {
      console.error(`[Thumbnail] ✗ épisode #${episodeId}:`, e.shortMessage ?? e.message)
      return null
    }
  }

  /**
   * Deletes the thumbnail for an episode (useful when the video file is removed).
   */
  async remove(episodeId: number): Promise<void> {
    const outputFile = path.join(this.thumbnailDir, `${episodeId}.jpg`)
    try {
      await fs.unlink(outputFile)
      console.log(`[Thumbnail] supprimé épisode #${episodeId}`)
    } catch {
    }
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.thumbnailDir, { recursive: true })
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}