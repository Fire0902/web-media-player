const BASE = 'https://api.jikan.moe/v4'
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class JikanService {
  private async get(url: string, retries = 3): Promise<any> {
    await delay(400)
    let res: Response
    try {
      res = await fetch(`${BASE}${url}`)
    } catch (e) {
      console.error(`[Jikan] fetch error on ${url}:`, e)
      return null
    }

    if (res.status === 429 && retries > 0) {
      console.warn(`[Jikan] 429 rate-limit sur ${url}, retry dans 1s (${retries} essais restants)`)
      await delay(1000)
      return this.get(url, retries - 1)
    }

    if (!res.ok) {
      return null
    }

    return res.json()
  }


  async searchAnime(name: string) {
    const data = await this.get(`/anime?q=${encodeURIComponent(name)}&limit=1`)
    if (!data?.data?.[0]) {
      console.warn(`[Jikan] aucun résultat pour "${name}"`)
      return null
    }
    return data.data[0]
  }

  /** Fetch a specific entry, used when an admin fixes a wrong match. */
  async getAnime(malId: number) {
    const data = await this.get(`/anime/${malId}`)
    return data?.data ?? null
  }

  async getAnimeCharacters(malId: number) {
    const data = await this.get(`/anime/${malId}/characters`)
    return data?.data ?? []
  }


  async getEpisode(malId: number, episodeNumberAbsolute: number) {
    const data = await this.get(`/anime/${malId}/episodes/${episodeNumberAbsolute}`)
    return data?.data ?? null
  }

  async hasEpisodeData(malId: number): Promise<boolean> {
    const data = await this.get(`/anime/${malId}/episodes/1`)
    const has = data?.data != null
    if (!has) {
      console.warn(`[Jikan] mal_id ${malId} : pas de données épisode (épisode 1 → 404)`)
    }
    return has
  }


  parseSeasonNumber(folderName: string): number | null {
    const patterns = [
      /saison\s*(\d+)/i,
      /season\s*(\d+)/i,
      /saga\s*(\d+)/i,
      /arc\s*(\d+)/i,
      /s(\d+)/i,
      /(\d+)/,
    ]
    for (const p of patterns) {
      const m = folderName.match(p)
      if (m) return parseInt(m[1], 10)
    }
    return null
  }

  /**
   * Extracts the episode number from a filename.
   *
   * Supported formats:
   *   Episode-1.mkv   Episode_1.mkv   Episode 1.mkv   episode01.mkv
   *   Ep-1.mkv        Ep_1.mkv        EP01.mkv
   *   E01.mkv         e1.mkv
   *   S01E01.mkv      s1e12.mkv
   *   Anime - 001.mkv
   *   01.mkv          001.mkv         1.mkv
   */
  parseEpisodeNumber(fileName: string): number | null {
    const base = fileName.replace(/\.[^.]+$/, '')

    const patterns = [
      /episode[-_\s]*(\d+)/i,
      /\bep[-_\s]*(\d+)/i,
      /s\d{1,2}e(\d{1,4})/i,
      /(?<![Ss]\d{1,2})[Ee](\d{1,4})\b/,
      /[-–]\s*(\d{1,4})\s*(?:[-–_.\[]|$)/,
      /\b(\d{1,4})$/,
      /\b(\d{1,4})\b/,
    ]

    for (const p of patterns) {
      const m = base.match(p)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > 0 && n < 2000) return n
      }
    }

    return null
  }


  extractVoiceActors(characters: any[]) {
    return characters.flatMap((c: any) =>
      (c.voice_actors ?? [])
        .filter((va: any) => va.language === 'Japanese')
        .map((va: any) => ({
          characterName: c.character?.name,
          characterImage: c.character?.images?.jpg?.image_url,
          actorName: va.person?.name,
          actorImage: va.person?.images?.jpg?.image_url,
        }))
    )
  }
}