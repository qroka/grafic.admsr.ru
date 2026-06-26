import type { ApiCrmParticipant, ApiEvent } from './types'
import type {
  ScheduleDateBlock,
  ScheduleParticipant,
  ScheduleRow,
  ScheduleSubstituteSlug,
  ScheduleUserGroup,
} from '../types/schedule'
import {
  createScheduleDateBlocks,
  ensureScheduleRowDetailMeta,
  findScheduleBlockIdByDate,
  scheduleParticipantKey,
} from '../utils/schedule'
import { ensureSubstituteGroup, isScheduleSubstituteSlug } from '../config/schedule'

export function crmParticipantToSchedule(p: ApiCrmParticipant): ScheduleParticipant {
  const parts = p.name.trim().split(/\s+/)
  return {
    externalId: p.id,
    login: p.login,
    name: p.name,
    avatarSrc: '',
    card: {
      line1: p.line1 ?? (parts.length > 1 ? parts.slice(0, -1).join(' ') : p.name),
      line2: p.line2 ?? (parts.length > 1 ? parts[parts.length - 1]! : ''),
      email: p.email ?? '',
      // Телефон и локация — после появления полей в CRM.
      phone: '',
      address: '',
    },
  }
}

function resolveApiCreator(event: ApiEvent): ScheduleParticipant | undefined {
  const raw = event.creator
  if (raw)
    return crmParticipantToSchedule(raw)
  return undefined
}

export function apiEventToScheduleRow(event: ApiEvent): ScheduleRow {
  const creator = resolveApiCreator(event)
  const participants = (event.participants ?? []).map(crmParticipantToSchedule)

  const detailFromApi = (event.detail ?? {}) as Record<string, unknown>
  const { createdAt: _ignored, organizer: _legacyOrganizer, ...detailRest } = detailFromApi

  const detail: NonNullable<ScheduleRow['detail']> = {
    ...detailRest,
    date: event.eventDate,
    allDay: event.allDay,
    creator,
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
    attachmentsHidden: event.attachmentsHidden,
    viewRestricted: Boolean(event.viewRestricted),
    attachmentsRestricted: Boolean(event.attachmentsRestricted),
    participants,
    attachmentsLabel: event.attachmentsLabel,
    attachmentFiles: event.attachments.map(a => ({
      id: a.id,
      name: a.name,
      size: a.sizeLabel,
      redacted: a.redacted,
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
  options?: { isCreate?: boolean },
) {
  const participantIds = row.participants
    .map(p => p.externalId)
    .filter((id): id is number => typeof id === 'number' && id > 0)

  const detailRaw = row.detail ?? null
  const detailForApi = detailRaw
    ? (() => {
        const copy = { ...detailRaw } as Record<string, unknown>
        delete copy.creator
        delete copy.organizer
        return Object.keys(copy).length ? copy : null
      })()
    : null

  const payload: Record<string, unknown> = {
    substituteSlug,
    eventDate,
    time: row.detail?.allDay ? '' : row.time,
    allDay: Boolean(row.detail?.allDay),
    placeLabel: row.placeLabel,
    placeAddress: row.placeAddress,
    topic: row.topic,
    hidden: Boolean(row.hidden),
    attachmentsHidden: Boolean(row.attachmentsHidden),
    completed: Boolean(row.detail?.completed),
    attachmentsLabel: row.attachmentsLabel,
    detail: detailForApi,
    participantIds,
  }

  if (options?.isCreate) {
    payload.creatorExternalId = row.detail?.creator?.externalId ?? null
  }

  return payload
}

export type ScheduleSelection = {
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
}

export function buildScheduleEventSelection(event: ApiEvent): ScheduleSelection | null {
  if (!event.substituteSlug || !isScheduleSubstituteSlug(event.substituteSlug))
    return null

  const blocks = createScheduleDateBlocks()
  const blockId = findScheduleBlockIdByDate(blocks, event.eventDate)
  const block = (blockId ? blocks.find(b => b.id === blockId) : undefined) ?? blocks[0]
  if (!block)
    return null

  const group = ensureSubstituteGroup(block, event.substituteSlug)
  const row = apiEventToScheduleRow(event)
  return { block, group, row }
}
