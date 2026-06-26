import type { EventRecord } from '../types/events.js'
import type { UserAccessProfile, UserRole } from '../types/auth.js'
import { isScheduleSubstituteSlug } from '../constants/schedule-slugs.js'

/** Участник или создатель мероприятия (CRM u_id). */
export function isEventParticipant(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'participantIds' | 'creatorExternalId'>,
): boolean {
  if (profile.externalUserId == null)
    return false
  const id = profile.externalUserId
  if (event.participantIds.includes(id))
    return true
  return event.creatorExternalId === id
}

/** Скрытые файлы без доступа: в графике видно количество, содержимое недоступно. */
export function shouldRedactHiddenAttachments(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'attachmentsHidden' | 'substituteSlug' | 'participantIds' | 'creatorExternalId'>,
): boolean {
  if (!event.attachmentsHidden)
    return false
  if (profile.role === 'admin')
    return false
  if (canEditSubstituteSlug(profile, event.substituteSlug))
    return false
  if (isEventParticipant(profile, event))
    return false
  return true
}

export function canViewEvent(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'hidden' | 'participantIds' | 'creatorExternalId' | 'substituteSlug'>,
): boolean {
  if (profile.role === 'admin')
    return true
  if (canEditSubstituteSlug(profile, event.substituteSlug))
    return true
  if (!event.hidden)
    return true
  // Скрытое мероприятие остаётся в графике; детали скрываются через shouldRedactHiddenEvent.
  return true
}

/** Скрытое мероприятие без доступа к деталям: в графике только время и плашка. */
export function shouldRedactHiddenEvent(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'hidden' | 'substituteSlug' | 'participantIds' | 'creatorExternalId'>,
): boolean {
  if (!event.hidden)
    return false
  if (profile.role === 'admin')
    return false
  if (canEditSubstituteSlug(profile, event.substituteSlug))
    return false
  if (isEventParticipant(profile, event))
    return false
  return true
}

export function canEditSubstituteSlug(
  profile: UserAccessProfile,
  substituteSlug: string,
): boolean {
  if (profile.role === 'admin')
    return isScheduleSubstituteSlug(substituteSlug)
  if (profile.role === 'user')
    return false
  return profile.editableSubstituteSlugs.includes(substituteSlug)
}

export function canEditEvent(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'substituteSlug'>,
): boolean {
  return canEditSubstituteSlug(profile, event.substituteSlug)
}

export function filterEventsForProfile(
  profile: UserAccessProfile,
  events: EventRecord[],
): EventRecord[] {
  return events.filter(event => canViewEvent(profile, event))
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Администратор',
    manager: 'Заместитель',
    assistant: 'Помощник заместителя',
    moderator: 'Модератор',
    user: 'Исполнитель',
  }
  return labels[role]
}
