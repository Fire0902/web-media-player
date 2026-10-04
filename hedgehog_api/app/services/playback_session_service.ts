/**
 * In-memory registry of who is watching what, fed by the progress
 * reports the player sends every few seconds. Powers the "active
 * sessions" panel of the admin dashboard; nothing is persisted.
 */

export interface PlaybackSession {
  userId: number
  userName: string
  episodeId: number
  position: number
  duration: number | null
  /** `direct`, `remux` or `transcode`, as reported by the player. */
  method: string
  paused: boolean
  updatedAt: number
}

/** A session with no report for this long is considered over. */
const SESSION_TTL_MS = 45_000

const sessions = new Map<number, PlaybackSession>()

export class PlaybackSessionService {
  report(session: Omit<PlaybackSession, 'updatedAt'>): void {
    sessions.set(session.userId, { ...session, updatedAt: Date.now() })
  }

  end(userId: number): void {
    sessions.delete(userId)
  }

  active(): PlaybackSession[] {
    const cutoff = Date.now() - SESSION_TTL_MS
    for (const [userId, session] of sessions) {
      if (session.updatedAt < cutoff) sessions.delete(userId)
    }
    return [...sessions.values()]
  }
}
