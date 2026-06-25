import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import type { Env } from './config/env.js'
import type { AuthUserPayload } from './types/auth.js'
import { initDatabase } from './db/sqlite.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { eventsRoutes } from './routes/events.js'
import { participantsRoutes } from './routes/participants.js'
import { attachmentsRoutes } from './routes/attachments.js'
import { logsRoutes } from './routes/logs.js'
import { crmUsersRoutes } from './routes/crm-users.js'
import { userThemeRoutes } from './routes/user-theme.js'
import { notificationsRoutes } from './routes/notifications.js'
import { ensureUploadDir } from './services/file-storage.js'
import { initNotificationMail } from './services/notification-mail.js'
import {
  requireAuthenticatedUser,
  syncUserFromDb,
} from './utils/auth-user.js'
import { AUTH_COOKIE_NAME } from './utils/auth-cookie.js'
import { parseCorsOrigins } from './utils/cors-origins.js'

declare module 'fastify' {
  interface FastifyInstance {
    config: { env: Env }
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
    requireAdmin: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserPayload
    user: AuthUserPayload
  }
}

export async function buildApp(env: Env) {
  initDatabase(env)
  await ensureUploadDir(env)

  const app = Fastify({
    logger: env.NODE_ENV === 'development',
    trustProxy: env.NODE_ENV === 'production' ? '127.0.0.1' : false,
  })

  initNotificationMail(env, app.log)
  app.decorate('config', { env })

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await app.register(cors, {
    origin: parseCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    cookie: {
      cookieName: AUTH_COOKIE_NAME,
      signed: false,
    },
  })

  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_BYTES },
  })

  app.decorate(
    'authenticate',
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply)
      if (!user)
        return
    },
  )

  app.decorate(
    'requireAdmin',
    async (request, reply) => {
      const user = syncUserFromDb(request)
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }
      if (user.role !== 'admin') {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }
    },
  )

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(eventsRoutes, { prefix: '/api' })
  await app.register(participantsRoutes, { prefix: '/api' })
  await app.register(attachmentsRoutes, { prefix: '/api' })
  await app.register(logsRoutes, { prefix: '/api' })
  await app.register(crmUsersRoutes, { prefix: '/api' })
  await app.register(userThemeRoutes, { prefix: '/api' })
  await app.register(notificationsRoutes, { prefix: '/api' })

  app.addHook('onClose', async () => {
    const { closeDatabase } = await import('./db/sqlite.js')
    closeDatabase()
  })

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    const err = error as { statusCode?: number, message?: string }
    const statusCode = err.statusCode ?? 500
    reply.status(statusCode).send({
      success: false,
      error: statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Request failed'),
    })
  })

  return app
}
