import User from '#models/user'
import { PlaybackSessionService } from '#services/playback_session_service'
import type { HttpContext } from '@adonisjs/core/http'

const playbackSessions = new PlaybackSessionService()

/** Minimum length accepted for any password. */
export const MIN_PASSWORD_LENGTH = 8

export default class SessionController {
  /** Exchange credentials for a bearer token. */
  async store({ request, auth }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    const user = await User.verifyCredentials(email, password)
    const token = await auth.use('api').createToken(user)

    return { type: 'bearer', token: token.value!.release(), user: user.serialize() }
  }

  /** Profile of the signed-in user. */
  async show({ auth }: HttpContext) {
    return auth.getUserOrFail().serialize()
  }

  /** Let users edit their own display name and password. */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { pseudo, currentPassword, password } = request.only([
      'pseudo',
      'currentPassword',
      'password',
    ])

    if (typeof pseudo === 'string' && pseudo.trim() && pseudo.trim() !== user.pseudo) {
      const taken = await User.query().where('pseudo', pseudo.trim()).whereNot('id', user.id).first()
      if (taken) return response.conflict({ error: 'This display name is already taken.' })
      user.pseudo = pseudo.trim()
    }

    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return response.badRequest({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        })
      }
      try {
        await User.verifyCredentials(user.email, String(currentPassword ?? ''))
      } catch {
        return response.badRequest({ error: 'Current password is incorrect.' })
      }
      user.password = password
    }

    await user.save()
    return user.serialize()
  }

  /** Revoke the token used for this request. */
  async destroy({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    playbackSessions.end(user.id)
    return response.noContent()
  }
}
