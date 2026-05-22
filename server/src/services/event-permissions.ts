import type { EventRecord } from '../types/events.js'
import type { UserAccessProfile, UserRole } from '../types/auth.js'
import { isScheduleSubstituteSlug } from '../constants/schedule-slugs.js'

export function isEventParticipant(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'participantIds'>,
): boolean {
  if (profile.externalUserId == null)
    return false
  return event.participantIds.includes(profile.externalUserId)
}

export function canViewEvent(
  profile: UserAccessProfile,
  event: Pick<EventRecord, 'hidden' | 'participantIds' | 'substituteSlug'>,
): boolean {
  if (profile.role === 'admin')
    return true
  // Редактор графика видит свои скрытые мероприятия (в т.ч. только что скрыл)
  if (canEditSubstituteSlug(profile, event.substituteSlug))
    return true
  if (!event.hidden)
    return true
  return isEventParticipant(profile, event)
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
    manager: 'Руководитель',
    moderator: 'Модератор',
    user: 'Пользователь',
  }
  return labels[role]
}
