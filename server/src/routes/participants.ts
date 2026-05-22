import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CrmParticipantsService } from '../services/crm-participants.js'
import { getRequestIp, logActivity } from '../services/activity-log.js'
import { jwtActor } from '../utils/request-context.js'

const listQuerySchema = z.object({
  search: z.string().optional(),
  ids: z.string().optional(),
})

export const participantsRoutes: FastifyPluginAsync = async app => {
  const crm = new CrmParticipantsService(app.config.env)

  app.get(
    '/participants',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: 'Invalid query' })
      }

      try {
        if (parsed.data.ids) {
          const ids = parsed.data.ids
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => Number.isInteger(n) && n > 0)
          const participants = await crm.getByIds(ids)
          return { success: true, participants, source: app.config.env.CRM_MOCK ? 'mock' : 'crm' }
        }

        const participants = await crm.list(parsed.data.search)
        return { success: true, participants, source: app.config.env.CRM_MOCK ? 'mock' : 'crm' }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'CRM unavailable'
        const actor = jwtActor(request)
        logActivity(app.config.env, {
          level: 'warning',
          category: 'participant',
          action: 'participant.fetch_failed',
          message: `CRM: ${message}`,
          userId: actor?.userId,
          userLogin: actor?.userLogin,
          userName: actor?.userName,
          ipAddress: getRequestIp(request),
        }, request.log)
        return reply.status(502).send({ success: false, error: message })
      }
    },
  )

  app.get(
    '/participants/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id)
      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ success: false, error: 'Invalid id' })
      }

      try {
        const participant = await crm.getById(id)
        if (!participant) {
          return reply.status(404).send({ success: false, error: 'Participant not found' })
        }
        return { success: true, participant, source: app.config.env.CRM_MOCK ? 'mock' : 'crm' }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'CRM unavailable'
        const actor = jwtActor(request)
        logActivity(app.config.env, {
          level: 'warning',
          category: 'participant',
          action: 'participant.fetch_failed',
          message: `CRM: ${message}`,
          userId: actor?.userId,
          userLogin: actor?.userLogin,
          userName: actor?.userName,
          ipAddress: getRequestIp(request),
        }, request.log)
        return reply.status(502).send({ success: false, error: message })
      }
    },
  )
}
