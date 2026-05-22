import type { FastifyReply, FastifyRequest } from 'fastify'
import { findUserById } from '../repositories/users.js'
import type { AuthUserPayload } from '../types/auth.js'

export function syncUserFromDb(
  request: FastifyRequest,
): AuthUserPayload | null {
  const jwtUser = request.user as AuthUserPayload | undefined
  if (!jwtUser?.userId)
    return null

  const dbUser = findUserById(jwtUser.userId)
  if (!dbUser)
    return null

  const fresh: AuthUserPayload = {
    sub: String(dbUser.id),
    userId: dbUser.id,
    login: dbUser.login,
    name: dbUser.name,
    email: dbUser.email ?? undefined,
    role: dbUser.role,
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

  const user = syncUserFromDb(request)
  if (!user) {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
    return undefined
  }

  return user
}
