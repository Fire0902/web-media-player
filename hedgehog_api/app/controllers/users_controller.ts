import User from '#models/user'
import UserAnimeFavorite from '#models/user_anime_favorite'
import UserEpisodeProgress from '#models/user_episode_progress'
import { MIN_PASSWORD_LENGTH } from '#controllers/session_controller'
import type { HttpContext } from '@adonisjs/core/http'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Account management, reserved to administrators. There is no public
 * sign-up: like on any private media server, an admin hands out the
 * accounts.
 */
export default class UsersController {
  async index({}: HttpContext) {
    const users = await User.query().orderBy('id', 'asc')
    return users.map((user) => user.serialize())
  }

  async store({ request, response }: HttpContext) {
    const { email, pseudo, password, isAdmin } = request.only([
      'email',
      'pseudo',
      'password',
      'isAdmin',
    ])

    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
      return response.badRequest({ error: 'A valid email is required.' })
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return response.badRequest({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
    }

    const conflict = await this.findConflict(email, pseudo)
    if (conflict) return response.conflict({ error: conflict })

    const user = await User.create({
      email,
      pseudo: typeof pseudo === 'string' && pseudo.trim() ? pseudo.trim() : null,
      password,
      isAdmin: Boolean(isAdmin),
    })
    return response.created(user.serialize())
  }

  async update({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const { email, pseudo, password, isAdmin } = request.only([
      'email',
      'pseudo',
      'password',
      'isAdmin',
    ])

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
        return response.badRequest({ error: 'A valid email is required.' })
      }
    }
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return response.badRequest({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        })
      }
      user.password = password
    }

    const conflict = await this.findConflict(email, pseudo, user.id)
    if (conflict) return response.conflict({ error: conflict })

    if (isAdmin !== undefined && Boolean(isAdmin) !== user.isAdmin) {
      if (!isAdmin && (await this.isLastAdmin(user))) {
        return response.badRequest({ error: 'The server needs at least one administrator.' })
      }
      user.isAdmin = Boolean(isAdmin)
    }

    if (typeof email === 'string') user.email = email
    if (pseudo !== undefined) {
      user.pseudo = typeof pseudo === 'string' && pseudo.trim() ? pseudo.trim() : null
    }

    await user.save()
    return user.serialize()
  }

  async destroy({ params, auth, response }: HttpContext) {
    const user = await User.findOrFail(params.id)

    if (user.id === auth.getUserOrFail().id) {
      return response.badRequest({ error: 'You cannot delete your own account.' })
    }
    if (await this.isLastAdmin(user)) {
      return response.badRequest({ error: 'The server needs at least one administrator.' })
    }

    // SQLite doesn't enforce the cascades unless foreign keys are
    // switched on, so clean the dependent rows by hand.
    await UserEpisodeProgress.query().where('user_id', user.id).delete()
    await UserAnimeFavorite.query().where('user_id', user.id).delete()
    for (const token of await User.accessTokens.all(user)) {
      await User.accessTokens.delete(user, token.identifier)
    }
    await user.delete()

    return response.noContent()
  }

  /** Human-readable reason when the email or display name is taken. */
  private async findConflict(
    email: unknown,
    pseudo: unknown,
    ignoreUserId?: number
  ): Promise<string | null> {
    if (typeof email === 'string') {
      const query = User.query().where('email', email)
      if (ignoreUserId) query.whereNot('id', ignoreUserId)
      if (await query.first()) return 'This email is already in use.'
    }
    if (typeof pseudo === 'string' && pseudo.trim()) {
      const query = User.query().where('pseudo', pseudo.trim())
      if (ignoreUserId) query.whereNot('id', ignoreUserId)
      if (await query.first()) return 'This display name is already taken.'
    }
    return null
  }

  private async isLastAdmin(user: User): Promise<boolean> {
    if (!user.isAdmin) return false
    const row = await User.query().where('is_admin', true).count('* as total').first()
    return Number(row?.$extras.total ?? 0) <= 1
  }
}
