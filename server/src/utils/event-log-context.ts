import type { EventRecord } from '../types/events.js'
import type { CrmParticipantsService } from '../services/crm-participants.js'
import type { EventLogContext } from '../services/event-activity-meta.js'

export async function resolveEventLogContext(
  event: EventRecord,
  crm: CrmParticipantsService,
): Promise<EventLogContext> {
  const ids = [...new Set(event.participantIds)]
  if (!ids.length)
    return { participantNames: [] }

  try {
    const people = await crm.getByIds(ids)
    const byId = new Map(
      people.map(p => [p.id, p.name.trim() || p.login.trim() || `ID ${p.id}`]),
    )
    return {
      participantNames: event.participantIds.map(id => byId.get(id) ?? `ID ${id}`),
    }
  } catch {
    return {
      participantNames: event.participantIds.map(id => `ID ${id}`),
    }
  }
}
