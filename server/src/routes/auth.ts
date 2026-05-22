import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'
import {
  verifyCredentials,
  findUserAccessById,
  toPublicUserProfile,
} from '../repositories/users.js'
import type { AuthUserPayload, LocalUser } from '../types/auth.js'
import { getRequestIp, logActivity } from '../services/activity-log.js'

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

function toJwtPayload(user: LocalUser): AuthUserPayload {
  return {
    sub: String(user.id),
    userId: user.id,
    login: user.login,
    name: user.name,
    email: user.email ?? undefined,
    role: user.role,
  }
}

export const authRoutes: FastifyPluginAsync = async app => {
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      success: false,
      error: 'Слишком много попыток входа. Повторите позже.',
    }),
  })

  app.post('/auth/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
        onExceeded: (request) => {
          const ip = getRequestIp(request)
          logActivity(app.config.env, {
            level: 'warning',
            category: 'auth',
            action: 'auth.login_rate_limited',
            message: 'Превышен лимит попыток входа',
            ipAddress: ip,
          }, request.log)
        },
      },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      })
    }

    const ip = getRequestIp(request)
    const user = await verifyCredentials(parsed.data.login, parsed.data.password)
    if (!user) {
      logActivity(app.config.env, {
        level: 'warning',
        category: 'auth',
        action: 'auth.login_failed',
        message: `Неудачная попытка входа: ${parsed.data.login}`,
        userLogin: parsed.data.login,
        ipAddress: ip,
      }, request.log)
      return reply.status(401).send({
        success: false,
        error: 'Invalid login or password',
      })
    }

    const profile = findUserAccessById(user.id)!
    const payload = toJwtPayload(user)
    const token = await reply.jwtSign(payload)

    logActivity(app.config.env, {
      level: 'success',
      category: 'auth',
      action: 'auth.login',
      message: 'Успешный вход в CRM',
      userId: user.id,
      userLogin: user.login,
      userName: user.name,
      ipAddress: ip,
    }, request.log)

    return {
      success: true,
      token,
      user: toPublicUserProfile(profile),
    }
  })

  app.get(
    '/auth/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const jwtUser = request.user as AuthUserPayload
      const profile = findUserAccessById(jwtUser.userId)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }
      return {
        success: true,
        user: toPublicUserProfile(profile),
      }
    },
  )

  // Stateless JWT: токен остаётся валидным до expiresIn, отзыва списка нет.
  app.post(
    '/auth/logout',
    { preHandler: [app.authenticate] },
    async () => ({ success: true }),
  )
}
