import type { FastifyBaseLogger } from 'fastify'

export function logRouteError(
  logger: FastifyBaseLogger | undefined,
  error: unknown,
  context: string,
): void {
  logger?.error({ err: error }, context)
}
