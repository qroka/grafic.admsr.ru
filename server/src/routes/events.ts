import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  createEvent,
  deleteEvent,
  findEventById,
  listEvents,
  updateEvent,
} from '../repositories/events.js'
import { CrmParticipantsService } from '../services/crm-participants.js'
import type { CrmParticipant } from '../types/crm.js'
import { getRequestIp, logActivity } from '../services/activity-log.js'
import {
  buildEventCreateLog,
  buildEventDeleteLog,
  buildEventUpdateLog,
} from '../services/event-activity-meta.js'
import { resolveEventLogContext } from '../utils/event-log-context.js'
import { jwtActor } from '../utils/request-context.js'
import { resolveUserAccess } from '../utils/event-access.js'
import {
  canEditEvent,
  canEditSubstituteSlug,
  canViewEvent,
  filterEventsForProfile,
} from '../services/event-permissions.js'

const createEventSchema = z.object({
  substituteSlug: z.string().min(1),
  eventDate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
  time: z.string().optional(),
  allDay: z.boolean().optional(),
  placeLabel: z.string().optional(),
  placeAddress: z.string().optional(),
  topic: z.string().min(1),
  hidden: z.boolean().optional(),
  completed: z.boolean().optional(),
  createdAt: z.string().optional(),
  organizerExternalId: z.number().int().positive().nullable().optional(),
  detail: z.record(z.string(), z.unknown()).nullable().optional(),
  participantIds: z.array(z.number().int().positive()).optional(),
})

const listQuerySchema = z.object({
  eventDate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/).optional(),
  substituteSlug: z.string().optional(),
})

type EventRecord = NonNullable<ReturnType<typeof findEventById>>

function collectExternalIds(events: EventRecord[]): number[] {
  const ids = new Set<number>()
  for (const event of events) {
    for (const id of event.participantIds)
      ids.add(id)
    if (event.organizerExternalId)
      ids.add(event.organizerExternalId)
  }
  return [...ids]
}

function enrichWithMap(
  event: EventRecord,
  byId: Map<number, CrmParticipant>,
) {
  return {
    ...event,
    participants: event.participantIds
      .map(id => byId.get(id))
      .filter(Boolean),
    organizer: event.organizerExternalId
      ? byId.get(event.organizerExternalId) ?? null
      : null,
  }
}

async function enrichEvent(
  event: EventRecord,
  crm: CrmParticipantsService,
) {
  const ids = [
    ...event.participantIds,
    ...(event.organizerExternalId ? [event.organizerExternalId] : []),
  ]
  const participants = await crm.getByIds(ids)
  const byId = new Map(participants.map(p => [p.id, p]))
  return enrichWithMap(event, byId)
}

async function enrichEvents(
  events: EventRecord[],
  crm: CrmParticipantsService,
) {
  const allIds = collectExternalIds(events)
  const participants = await crm.getByIds(allIds)
  const byId = new Map(participants.map(p => [p.id, p]))
  return events.map(event => enrichWithMap(event, byId))
}

export const eventsRoutes: FastifyPluginAsync = async app => {
  const crm = new CrmParticipantsService(app.config.env)

  app.get(
    '/events',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: 'Invalid query' })
      }

      try {
        const events = filterEventsForProfile(
          profile,
          listEvents(parsed.data),
        )
        const enriched = await enrichEvents(events, crm)
        return { success: true, events: enriched }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list events'
        return reply.status(500).send({ success: false, error: message })
      }
    },
  )

  app.get(
    '/events/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const id = Number((request.params as { id: string }).id)
      const event = findEventById(id)
      if (!event || !canViewEvent(profile, event)) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

      try {
        return { success: true, event: await enrichEvent(event, crm) }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load event'
        return reply.status(502).send({ success: false, error: message })
      }
    },
  )

  app.post(
    '/events',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const parsed = createEventSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid body',
          details: parsed.error.flatten(),
        })
      }

      if (!canEditSubstituteSlug(profile, parsed.data.substituteSlug)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }

      const event = createEvent(parsed.data)
      const actor = jwtActor(request)
      const logCtx = await resolveEventLogContext(event, crm)
      const createLog = buildEventCreateLog(event, logCtx)
      logActivity(app.config.env, {
        level: 'info',
        category: 'event',
        action: 'event.create',
        message: createLog.message,
        userId: actor?.userId,
        userLogin: actor?.userLogin,
        userName: actor?.userName,
        entityType: 'event',
        entityId: event.id,
        ipAddress: getRequestIp(request),
        meta: createLog.meta,
      }, request.log)
      try {
        return reply.status(201).send({
          success: true,
          event: await enrichEvent(event, crm),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to enrich event'
        return reply.status(502).send({ success: false, error: message })
      }
    },
  )

  app.patch(
    '/events/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const id = Number((request.params as { id: string }).id)
      const parsed = createEventSchema.partial().safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid body',
          details: parsed.error.flatten(),
        })
      }

      const existing = findEventById(id)
      if (!existing || !canViewEvent(profile, existing)) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

      if (!canEditEvent(profile, existing)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }

      const targetSlug = parsed.data.substituteSlug ?? existing.substituteSlug
      if (!canEditSubstituteSlug(profile, targetSlug)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }

      const event = updateEvent(id, parsed.data)
      if (!event) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

      const actor = jwtActor(request)
      const [beforeCtx, afterCtx] = await Promise.all([
        resolveEventLogContext(existing, crm),
        resolveEventLogContext(event, crm),
      ])
      const updateLog = buildEventUpdateLog(existing, event, beforeCtx, afterCtx)
      logActivity(app.config.env, {
        level: 'info',
        category: 'event',
        action: 'event.update',
        message: updateLog.message,
        userId: actor?.userId,
        userLogin: actor?.userLogin,
        userName: actor?.userName,
        entityType: 'event',
        entityId: event.id,
        ipAddress: getRequestIp(request),
        meta: updateLog.meta,
      }, request.log)

      try {
        return { success: true, event: await enrichEvent(event, crm) }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to enrich event'
        return reply.status(502).send({ success: false, error: message })
      }
    },
  )

  app.delete(
    '/events/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const id = Number((request.params as { id: string }).id)
      const existing = findEventById(id)
      if (!existing || !canViewEvent(profile, existing)) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

      if (!canEditEvent(profile, existing)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' })
      }

      const removed = await deleteEvent(app.config.env, id)
      if (!removed) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

      const actor = jwtActor(request)
      const deleteCtx = await resolveEventLogContext(existing, crm)
      const deleteLog = buildEventDeleteLog(existing, deleteCtx)
      logActivity(app.config.env, {
        level: 'info',
        category: 'event',
        action: 'event.delete',
        message: deleteLog.message,
        userId: actor?.userId,
        userLogin: actor?.userLogin,
        userName: actor?.userName,
        entityType: 'event',
        entityId: id,
        ipAddress: getRequestIp(request),
        meta: deleteLog.meta,
      }, request.log)

      return { success: true }
    },
  )
}
