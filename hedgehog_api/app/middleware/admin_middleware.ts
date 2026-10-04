import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Restrict a route to administrators. Must run after the `auth`
 * middleware so `ctx.auth.user` is already populated.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    if (!user.isAdmin) {
      return ctx.response.forbidden({ error: 'Administrator access required.' })
    }
    return next()
  }
}
