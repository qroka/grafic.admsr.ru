import { figmaScheduleAssets } from '../config/figma-mcp-assets'
import type { ApiCrmParticipant, ApiEvent } from './types'
import type {
  ScheduleDateBlock,
  ScheduleParticipant,
  ScheduleRow,
  ScheduleSubstituteSlug,
  ScheduleUserGroup,
} from '../types/schedule'
import {
  ensureScheduleRowDetailMeta,
  findScheduleBlockIdByDate,
} from '../utils/schedule'
import { ensureSubstituteGroup, isScheduleSubstituteSlug } from '../config/schedule'

export function crmParticipantToSchedule(p: ApiCrmParticipant): ScheduleParticipant {
  const parts = p.name.trim().split(/\s+/)
  return {
    externalId: p.id,
    name: p.name,
    avatarSrc: p.avatar ?? figmaScheduleAssets.avatar,
    card: {
      line1: p.line1 ?? (parts.length > 1 ? parts.slice(0, -1).join(' ') : p.name),
      line2: p.line2 ?? (parts.length > 1 ? parts[parts.length - 1]! : ''),
      email: p.email ?? '',
      phone: p.phone ?? '',
      address: p.address ?? '',
    },
  }
}

export function apiEventToScheduleRow(event: ApiEvent): ScheduleRow {
  const participants = (event.participants ?? []).map(crmParticipantToSchedule)
  const organizer = event.organizer
    ? crmParticipantToSchedule(event.organizer)
    : undefined

  const detailFromApi = (event.detail ?? {}) as Record<string, unknown>
  const { createdAt: _ignored, ...detailRest } = detailFromApi

  const detail: NonNullable<ScheduleRow['detail']> = {
    ...detailRest,
    date: event.eventDate,
    allDay: event.allDay,
    organizer,
  }

  if (event.createdAt?.trim())
    detail.createdAt = event.createdAt.trim()

  const row: ScheduleRow = {
    apiId: event.id,
    time: event.time,
    placeLabel: event.placeLabel,
    placeAddress: event.placeAddress,
    topic: event.topic,
    hidden: event.hidden,
    participants,
    attachmentsLabel: event.attachmentsLabel,
    attachmentFiles: event.attachments.map(a => ({
      id: a.id,
      name: a.name,
      size: a.sizeLabel,
    })),
    detail,
  }

  if (!event.createdAt?.trim())
    ensureScheduleRowDetailMeta(row, event.eventDate)

  return row
}

export function mergeEventsIntoBlocks(
  blocks: ScheduleDateBlock[],
  events: ApiEvent[],
): void {
  for (const block of blocks)
    block.groups = []

  for (const event of events) {
    if (!isScheduleSubstituteSlug(event.substituteSlug))
      continue

    const blockId = findScheduleBlockIdByDate(blocks, event.eventDate)
    const block = blockId
      ? blocks.find(b => b.id === blockId)
      : undefined
    if (!block)
      continue

    const group = ensureSubstituteGroup(
      block,
      event.substituteSlug as ScheduleSubstituteSlug,
    )
    group.rows.push(apiEventToScheduleRow(event))
  }
}

export function scheduleRowToApiPayload(
  row: ScheduleRow,
  substituteSlug: ScheduleSubstituteSlug,
  eventDate: string,
) {
  return {
    substituteSlug,
    eventDate,
    time: row.detail?.allDay ? '' : row.time,
    allDay: Boolean(row.detail?.allDay),
    placeLabel: row.placeLabel,
    placeAddress: row.placeAddress,
    topic: row.topic,
    hidden: Boolean(row.hidden),
    completed: Boolean(row.detail?.completed),
    organizerExternalId: row.detail?.organizer?.externalId ?? null,
    attachmentsLabel: row.attachmentsLabel,
    detail: row.detail ?? null,
    participantIds: row.participants
      .map(p => p.externalId)
      .filter((id): id is number => typeof id === 'number'),
  }
}

export type ScheduleSelection = {
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
}
