import type { FastifyRequest } from 'fastify'
import { findUserAccessById } from '../repositories/users.js'
import type { AuthUserPayload, UserAccessProfile } from '../types/auth.js'

export function resolveUserAccess(
  request: FastifyRequest,
): UserAccessProfile | null {
  const jwtUser = request.user as AuthUserPayload | undefined
  if (!jwtUser?.userId)
    return null
  return findUserAccessById(jwtUser.userId)
}
