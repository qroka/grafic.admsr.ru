import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  verifyCredentials,
  findUserAccessById,
  toPublicUserProfile,
  upsertUserFromCrm,
} from '../repositories/users.js'
import type { Env } from '../config/env.js'
import type { AuthUserPayload, LocalUser } from '../types/auth.js'
import { getRequestIp, logActivity } from '../services/activity-log.js'
import {
  lookupCrmUser,
  mapCrmUserToLocalFields,
  verifyCrmSsoToken,
} from '../services/crm-auth.js'
import { consumeSsoTokenOnce } from '../services/sso-token-store.js'
import { getUserAuthEpoch, revokeJwt } from '../services/jwt-revocation-store.js'
import { clearAuthCookie, setAuthCookie } from '../utils/auth-cookie.js'
import { canUseLocalAuth, isCrmAuthRequired } from '../utils/local-auth-policy.js'

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

const crmSsoSchema = z.object({
  token: z.string().min(10),
})

function scheduleSsoSecret(env: { SCHEDULE_SSO_SECRET?: string, CRM_SYNC_SECRET: string }): string {
  return env.SCHEDULE_SSO_SECRET?.trim() || env.CRM_SYNC_SECRET
}

async function signInLocalUser(
  user: LocalUser,
  reply: FastifyReply,
  env: Env,
) {
  const profile = findUserAccessById(user.id)!
  const token = await reply.jwtSign(toJwtPayload(user))
  setAuthCookie(reply, token, env)
  return { user: toPublicUserProfile(profile) }
}

function toJwtPayload(user: LocalUser): AuthUserPayload {
  return {
    sub: String(user.id),
    userId: user.id,
    login: user.login,
    name: user.name,
    email: user.email ?? undefined,
    role: user.role,
    jti: randomUUID(),
    authEpoch: getUserAuthEpoch(user.id),
  }
}

async function resolveLoginUser(
  env: Env,
  login: string,
  password: string,
): Promise<{ user: LocalUser | null, viaCrm: boolean, crmUnavailable: boolean }> {
  const lookup = await lookupCrmUser(env, login, password)

  if (lookup.status === 'found') {
    return {
      user: upsertUserFromCrm(mapCrmUserToLocalFields(lookup.user)),
      viaCrm: true,
      crmUnavailable: false,
    }
  }

  if (lookup.status === 'unavailable' && isCrmAuthRequired(env) && !canUseLocalAuth(env, login)) {
    return { user: null, viaCrm: false, crmUnavailable: true }
  }

  if (!canUseLocalAuth(env, login)) {
    return { user: null, viaCrm: false, crmUnavailable: false }
  }

  const user = await verifyCredentials(login, password)
  return { user, viaCrm: false, crmUnavailable: lookup.status === 'unavailable' }
}

export const authRoutes: FastifyPluginAsync = async app => {
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
      })
    }

    const ip = getRequestIp(request)
    const { user, viaCrm, crmUnavailable } = await resolveLoginUser(
      app.config.env,
      parsed.data.login,
      parsed.data.password,
    )

    if (crmUnavailable) {
      return reply.status(503).send({
        success: false,
        error: 'CRM authentication service unavailable',
      })
    }

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

    const { user: publicProfile } = await signInLocalUser(user, reply, app.config.env)

    logActivity(app.config.env, {
      level: 'success',
      category: 'auth',
      action: viaCrm ? 'auth.login_crm' : 'auth.login',
      message: viaCrm ? 'Вход через CRM (login)' : 'Вход (локальная учётка)',
      userId: user.id,
      userLogin: user.login,
      userName: user.name,
      ipAddress: ip,
    }, request.log)

    return {
      success: true,
      user: publicProfile,
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

  app.post('/auth/logout', async (request, reply) => {
    try {
      await request.jwtVerify()
      const jwtUser = request.user as AuthUserPayload
      if (jwtUser.jti) {
        const exp = jwtUser.exp ?? Math.floor(Date.now() / 1000) + 8 * 60 * 60
        revokeJwt(jwtUser.jti, exp)
      }
    } catch {
      // токен мог истечь — всё равно сбрасываем cookie
    }
    clearAuthCookie(reply, app.config.env)
    return { success: true }
  })

  /** SSO из CRM: одноразовый токен из schedule.php (#sso=...). */
  app.post('/auth/crm-sso', async (request, reply) => {
    const parsed = crmSsoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request body' })
    }

    const ssoToken = parsed.data.token
    const payload = verifyCrmSsoToken(
      ssoToken,
      scheduleSsoSecret(app.config.env),
    )
    if (!payload) {
      return reply.status(401).send({ success: false, error: 'Invalid or expired SSO token' })
    }

    if (!consumeSsoTokenOnce(ssoToken, payload.exp)) {
      return reply.status(401).send({ success: false, error: 'SSO token already used' })
    }

    const fields = mapCrmUserToLocalFields(payload)
    const user = upsertUserFromCrm(fields)
    const ip = getRequestIp(request)
    const { user: publicProfile } = await signInLocalUser(user, reply, app.config.env)

    logActivity(app.config.env, {
      level: 'success',
      category: 'auth',
      action: 'auth.crm_sso',
      message: 'Вход через CRM SSO',
      userId: user.id,
      userLogin: user.login,
      userName: user.name,
      ipAddress: ip,
    }, request.log)

    return { success: true, user: publicProfile }
  })

  /** Проверка логина/пароля CRM (crm_lookup.php) и выдача JWT. */
  app.post('/auth/crm-bridge', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request body' })
    }

    const lookup = await lookupCrmUser(
      app.config.env,
      parsed.data.login,
      parsed.data.password,
    )

    if (lookup.status === 'unavailable' && isCrmAuthRequired(app.config.env)) {
      return reply.status(503).send({
        success: false,
        error: 'CRM authentication service unavailable',
      })
    }

    if (lookup.status !== 'found') {
      return reply.status(401).send({ success: false, error: 'Invalid login or password' })
    }

    const fields = mapCrmUserToLocalFields(lookup.user)
    const user = upsertUserFromCrm(fields)
    const { user: publicProfile } = await signInLocalUser(user, reply, app.config.env)

    logActivity(app.config.env, {
      level: 'success',
      category: 'auth',
      action: 'auth.crm_bridge',
      message: 'Вход через CRM (логин/пароль)',
      userId: user.id,
      userLogin: user.login,
      userName: user.name,
      ipAddress: getRequestIp(request),
    }, request.log)

    return { success: true, user: publicProfile }
  })
}
