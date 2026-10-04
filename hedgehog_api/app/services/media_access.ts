import path from 'path'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import type Episode from '#models/episode'

/**
 * Helpers shared by the endpoints that hand media to the browser.
 */

/**
 * Authenticate a request from its `?token=` query parameter.
 *
 * `<video src>`, `<track src>` and JASSUB's `subUrl` can't send an
 * `Authorization` header, so those endpoints take the token in the URL.
 */
export async function userFromQueryToken(request: HttpContext['request']): Promise<User | null> {
  const token = request.qs().token
  if (typeof token !== 'string' || !token) return null
  try {
    const accessToken = await User.accessTokens.verify(new Secret(token))
    if (!accessToken) return null
    return await User.find(accessToken.tokenableId)
  } catch {
    return null
  }
}

/**
 * Absolute path of an episode on disk, or null when the stored path
 * points outside the media root.
 */
export function resolveEpisodePath(episode: Episode): string | null {
  const safePath = path.resolve(episode.path.replace(/\//g, path.sep))
  const mediaRoot = app.makePath('media')
  if (safePath !== mediaRoot && !safePath.startsWith(mediaRoot + path.sep)) return null
  return safePath
}
