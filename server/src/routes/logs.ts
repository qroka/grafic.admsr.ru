import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { listActivityLogs } from '../repositories/activity-logs.js'

const listQuerySchema = z.object({
  q: z.string().optional(),
  level: z.enum(['info', 'success', 'warning', 'error']).optional(),
  category: z.enum(['auth', 'event', 'attachment', 'participant', 'system']).optional(),
  scope: z.enum(['business', 'system']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const logsRoutes: FastifyPluginAsync = async app => {
  app.get(
    '/logs',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query',
          details: parsed.error.flatten(),
        })
      }

      const { total, items } = listActivityLogs(parsed.data)
      return { success: true, total, items }
    },
  )
}
