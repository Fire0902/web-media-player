import User from '#models/user'
import { MIN_PASSWORD_LENGTH } from '#controllers/session_controller'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * First-time setup endpoints.
 *
 * The frontend hits `GET /setup` once on boot to know whether a sign-in
 * screen should be shown or whether the instance is brand new and the
 * user should create the very first administrator account through
 * `POST /setup`. The latter is an unauthenticated endpoint but is only
 * accepted while the `users` table is empty — once the first user is
 * created any subsequent call returns a `409 Conflict`.
 */
export default class SetupController {
  /** Report whether the instance still needs its first administrator. */
  async status({ response }: HttpContext) {
    const row = await User.query().count('* as total').first()
    const total = Number(row?.$extras.total ?? 0)
    return response.ok({ needsSetup: total === 0 })
  }

  /** Create the first administrator and issue an access token for it. */
  async create({ request, response, auth }: HttpContext) {
    const existing = await User.query().count('* as total').first()
    const total = Number(existing?.$extras.total ?? 0)
    if (total > 0) {
      return response.conflict({ error: 'Setup already completed.' })
    }

    const { email, pseudo, password } = request.only(['email', 'pseudo', 'password'])

    if (!email || !password) {
      return response.badRequest({ error: 'Email and password are required.' })
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return response.badRequest({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
    }

    const user = await User.create({ email, pseudo: pseudo || null, password, isAdmin: true })
    const token = await auth.use('api').createToken(user)
    return response.created({
      type: 'bearer',
      token: token.value!.release(),
      user: user.serialize(),
    })
  }
}
