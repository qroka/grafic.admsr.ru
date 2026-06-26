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
import {
  collectEventCancelRecipients,
  diffParticipantIds,
  notifyEventCancelled,
  notifyEventUpdated,
  notifyParticipantsAdded,
  notifyParticipantsRemoved,
} from '../services/event-notifications.js'
import { resolveEventLogContext } from '../utils/event-log-context.js'
import { jwtActor } from '../utils/request-context.js'
import { resolveUserAccess } from '../utils/event-access.js'
import {
  canEditEvent,
  canEditSubstituteSlug,
  canViewEvent,
  filterEventsForProfile,
} from '../services/event-permissions.js'
import type { LocalUser, UserAccessProfile } from '../types/auth.js'
import { findLocalUsersByExternalIds } from '../repositories/users.js'
import {
  applyEventVisibilityForProfile,
  type EnrichedEvent,
} from '../utils/event-visibility.js'
import {
  resolveEventCreator,
  resolveEventParticipants,
} from '../utils/resolve-event-participants.js'

const createEventSchema = z.object({
  substituteSlug: z.string().min(1),
  eventDate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
  time: z.string().optional(),
  allDay: z.boolean().optional(),
  placeLabel: z.string().optional(),
  placeAddress: z.string().optional(),
  topic: z.string().min(1),
  hidden: z.boolean().optional(),
  attachmentsHidden: z.boolean().optional(),
  completed: z.boolean().optional(),
  createdAt: z.string().optional(),
  creatorExternalId: z.number().int().positive().nullable().optional(),
  /** @deprecated используйте creatorExternalId */
  organizerExternalId: z.number().int().positive().nullable().optional(),
  detail: z.record(z.string(), z.unknown()).nullable().optional(),
  participantIds: z.array(z.number().int().positive()).optional(),
})

const listQuerySchema = z.object({
  eventDate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/).optional(),
  substituteSlug: z.string().optional(),
})

type EventRecord = NonNullable<ReturnType<typeof findEventById>>

function resolveCreatorExternalId(data: {
  creatorExternalId?: number | null
  organizerExternalId?: number | null
}): number | null | undefined {
  if (data.creatorExternalId !== undefined)
    return data.creatorExternalId
  if (data.organizerExternalId !== undefined)
    return data.organizerExternalId
  return undefined
}

function collectExternalIds(events: EventRecord[]): number[] {
  const ids = new Set<number>()
  for (const event of events) {
    for (const id of event.participantIds)
      ids.add(id)
    if (event.creatorExternalId)
      ids.add(event.creatorExternalId)
  }
  return [...ids]
}

function enrichWithMap(
  event: EventRecord,
  crmById: Map<number, CrmParticipant>,
  localByExternalId: Map<number, LocalUser>,
): EnrichedEvent {
  return {
    ...event,
    participants: resolveEventParticipants(
      event.participantIds,
      crmById,
      localByExternalId,
    ),
    creator: resolveEventCreator(
      event.creatorExternalId,
      crmById,
      localByExternalId,
    ),
  }
}

async function loadParticipantMaps(
  ids: number[],
  crm: CrmParticipantsService,
) {
  const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))]
  const crmParticipants = await crm.getByIds(uniqueIds)
  const crmById = new Map(crmParticipants.map(p => [p.id, p]))
  const missingIds = uniqueIds.filter(id => !crmById.has(id))
  const localByExternalId = findLocalUsersByExternalIds(missingIds)
  return { crmById, localByExternalId }
}

async function enrichEvent(
  event: EventRecord,
  crm: CrmParticipantsService,
  profile: UserAccessProfile,
) {
  const ids = [
    ...event.participantIds,
    ...(event.creatorExternalId ? [event.creatorExternalId] : []),
  ]
  const { crmById, localByExternalId } = await loadParticipantMaps(ids, crm)
  return applyEventVisibilityForProfile(
    enrichWithMap(event, crmById, localByExternalId),
    profile,
  )
}

async function enrichEvents(
  events: EventRecord[],
  crm: CrmParticipantsService,
  profile: UserAccessProfile,
) {
  const allIds = collectExternalIds(events)
  const { crmById, localByExternalId } = await loadParticipantMaps(allIds, crm)
  return events.map(event =>
    applyEventVisibilityForProfile(
      enrichWithMap(event, crmById, localByExternalId),
      profile,
    ),
  )
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
        const enriched = await enrichEvents(events, crm, profile)
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
        return { success: true, event: await enrichEvent(event, crm, profile) }
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

      const event = createEvent({
        ...parsed.data,
        creatorExternalId:
          resolveCreatorExternalId(parsed.data) ?? profile.externalUserId ?? null,
      })
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

      notifyParticipantsAdded(event, event.participantIds)

      try {
        return reply.status(201).send({
          success: true,
          event: await enrichEvent(event, crm, profile),
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

      const { creatorExternalId: _c, organizerExternalId: _o, ...patchBody } = parsed.data
      const event = updateEvent(id, patchBody)
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

      const participantDiff = diffParticipantIds(
        existing.participantIds,
        event.participantIds,
      )
      notifyParticipantsAdded(event, participantDiff.added)
      notifyParticipantsRemoved(event, participantDiff.removed)

      const continuingParticipants = event.participantIds.filter(
        id => existing.participantIds.includes(id),
      )
      notifyEventUpdated(
        event,
        updateLog.meta.changes,
        continuingParticipants,
      )

      try {
        return { success: true, event: await enrichEvent(event, crm, profile) }
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

      const actor = jwtActor(request)
      const cancelRecipients = collectEventCancelRecipients(existing)
      let notified = 0
      try {
        notified = notifyEventCancelled(existing, cancelRecipients)
        request.log.info({
          eventId: id,
          recipientExternalIds: cancelRecipients,
          notified,
        }, 'event cancel notifications')
        if (cancelRecipients.length && notified < cancelRecipients.length) {
          request.log.warn({
            eventId: id,
            recipientExternalIds: cancelRecipients,
            notified,
          }, 'cancel notifications skipped: participant has no local grafic account')
        }
      } catch (err) {
        request.log.error({ err, eventId: id, cancelRecipients }, 'event cancel notifications failed')
      }

      const removed = await deleteEvent(app.config.env, id)
      if (!removed) {
        return reply.status(404).send({ success: false, error: 'Event not found' })
      }

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
