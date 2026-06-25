import type { FastifyReply, FastifyRequest } from 'fastify'
import { findUserById } from '../repositories/users.js'
import type { AuthUserPayload } from '../types/auth.js'
import {
  getUserAuthEpoch,
  isJwtRevoked,
} from '../services/jwt-revocation-store.js'

export function syncUserFromDb(
  request: FastifyRequest,
): AuthUserPayload | null {
  const jwtUser = request.user as AuthUserPayload | undefined
  if (!jwtUser?.userId)
    return null

  const dbUser = findUserById(jwtUser.userId)
  if (!dbUser)
    return null

  const authEpoch = getUserAuthEpoch(dbUser.id)
  const tokenEpoch = jwtUser.authEpoch ?? 0
  if (tokenEpoch !== authEpoch)
    return null

  const fresh: AuthUserPayload = {
    sub: String(dbUser.id),
    userId: dbUser.id,
    login: dbUser.login,
    name: dbUser.name,
    email: dbUser.email ?? undefined,
    role: dbUser.role,
    jti: jwtUser.jti,
    authEpoch,
    exp: jwtUser.exp,
  }
  request.user = fresh
  return fresh
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUserPayload | undefined> {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
    return undefined
  }

  const jwtUser = request.user as AuthUserPayload
  if (jwtUser.jti && isJwtRevoked(jwtUser.jti)) {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
    return undefined
  }

  const user = syncUserFromDb(request)
  if (!user) {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
    return undefined
  }

  return user
}
