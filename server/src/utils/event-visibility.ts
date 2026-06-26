import type { EventRecord } from '../types/events.js'
import type { CrmParticipant } from '../types/crm.js'
import type { UserAccessProfile } from '../types/auth.js'
import {
  shouldRedactHiddenAttachments,
  shouldRedactHiddenEvent,
} from '../services/event-permissions.js'

export type EnrichedEvent = EventRecord & {
  participants?: CrmParticipant[]
  creator?: CrmParticipant | null
  viewRestricted?: boolean
  attachmentsRestricted?: boolean
}

function redactAttachments(event: EnrichedEvent): EnrichedEvent {
  return {
    ...event,
    attachmentsRestricted: true,
    attachments: event.attachments.map(a => ({
      id: a.id,
      name: '',
      sizeLabel: '',
      mimeType: '',
      hasFile: false,
      redacted: true,
    })),
  }
}

export function applyEventVisibilityForProfile(
  event: EnrichedEvent,
  profile: UserAccessProfile,
): EnrichedEvent {
  if (shouldRedactHiddenEvent(profile, event)) {
    const detail = {
      ...(event.detail ?? {}),
      viewRestricted: true,
    }

    return {
      ...event,
      topic: '',
      placeLabel: '',
      placeAddress: '',
      attachmentsLabel: 'Нет файлов',
      attachments: [],
      participants: [],
      creator: null,
      detail,
      viewRestricted: true,
    }
  }

  if (shouldRedactHiddenAttachments(profile, event))
    return redactAttachments(event)

  return event
}
