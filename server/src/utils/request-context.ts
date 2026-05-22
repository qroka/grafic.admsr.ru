import type { FastifyRequest } from 'fastify'
import type { AuthUserPayload } from '../types/auth.js'

export function jwtActor(request: FastifyRequest): {
  userId: number
  userLogin: string
  userName: string
} | null {
  const user = request.user as AuthUserPayload | undefined
  if (!user?.userId)
    return null
  return {
    userId: user.userId,
    userLogin: user.login,
    userName: user.name,
  }
}
