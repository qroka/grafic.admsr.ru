import type { EventRecord } from '../types/events.js'

export interface EventLogField {
  key: string
  label: string
  value: string
}

export interface EventLogChange {
  key: string
  label: string
  before: string
  after: string
}

export interface EventLogContext {
  participantNames: string[]
}

const FIELD_LABELS: Record<string, string> = {
  substituteSlug: 'График',
  eventDate: 'Дата',
  time: 'Время',
  allDay: 'Весь день',
  placeAddress: 'Адрес',
  topic: 'Тема',
  hidden: 'Скрыто',
  attachmentsHidden: 'Скрыть файлы',
  participants: 'Участники',
  attachments: 'Файлы',
}

const SUBSTITUTE_LABELS: Record<string, string> = {
  general: 'Общий график',
  marcenkovskiy: 'Марценковский Р.Ф.',
  markova: 'Маркова Ю.В.',
  sidorov: 'Сидоров П.А.',
  zhuravskaya: 'Журавская О.Р.',
}

const TRACKED_KEYS = [
  'substituteSlug',
  'eventDate',
  'time',
  'allDay',
  'placeAddress',
  'topic',
  'hidden',
  'attachmentsHidden',
] as const

type TrackedKey = (typeof TRACKED_KEYS)[number]

function formatBool(value: boolean, yes: string, no: string): string {
  return value ? yes : no
}

function formatAddress(event: EventRecord): string {
  const parts = [event.placeLabel.trim(), event.placeAddress.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function formatParticipants(names: string[]): string {
  if (!names.length)
    return '—'
  return names.join('; ')
}

function formatAttachmentNames(event: EventRecord): string {
  const names = event.attachments.map(a => a.name.trim()).filter(Boolean)
  return names.length ? names.join('; ') : '—'
}

function snapshotValue(key: TrackedKey, event: EventRecord): string {
  switch (key) {
    case 'substituteSlug':
      return SUBSTITUTE_LABELS[event.substituteSlug] ?? event.substituteSlug
    case 'eventDate':
      return event.eventDate
    case 'time':
      return event.allDay ? '—' : event.time
    case 'allDay':
      return formatBool(event.allDay, 'Да', 'Нет')
    case 'placeAddress':
      return formatAddress(event)
    case 'topic':
      return event.topic
    case 'hidden':
      return formatBool(event.hidden, 'Да', 'Нет')
    case 'attachmentsHidden':
      return formatBool(event.attachmentsHidden, 'Да', 'Нет')
    default:
      return '—'
  }
}

function extraFields(event: EventRecord, context: EventLogContext): EventLogField[] {
  const fields: EventLogField[] = [{
    key: 'participants',
    label: FIELD_LABELS.participants!,
    value: formatParticipants(context.participantNames),
  }]
  const files = formatAttachmentNames(event)
  if (files !== '—') {
    fields.push({
      key: 'attachments',
      label: FIELD_LABELS.attachments!,
      value: files,
    })
  }
  return fields
}

function allFields(event: EventRecord, context: EventLogContext): EventLogField[] {
  return [
    ...TRACKED_KEYS.map(key => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: snapshotValue(key, event),
    })),
    ...extraFields(event, context),
  ]
}

function fieldValue(
  key: string,
  event: EventRecord,
  context: EventLogContext,
): string {
  if (key === 'participants')
    return formatParticipants(context.participantNames)
  if (key === 'attachments')
    return formatAttachmentNames(event)
  if ((TRACKED_KEYS as readonly string[]).includes(key))
    return snapshotValue(key as TrackedKey, event)
  return '—'
}

export function buildEventCreateLog(
  event: EventRecord,
  context: EventLogContext,
): {
  message: string
  meta: { kind: 'event.create'; fields: EventLogField[] }
} {
  return {
    message: `Создано мероприятие «${event.topic}» (ID ${event.id})`,
    meta: { kind: 'event.create', fields: allFields(event, context) },
  }
}

export function buildEventUpdateLog(
  before: EventRecord,
  after: EventRecord,
  beforeCtx: EventLogContext,
  afterCtx: EventLogContext,
): {
  message: string
  meta: { kind: 'event.update'; changes: EventLogChange[] }
} {
  const keys = [...TRACKED_KEYS, 'participants', 'attachments'] as const
  const changes: EventLogChange[] = []

  for (const key of keys) {
    const beforeVal = fieldValue(key, before, beforeCtx)
    const afterVal = fieldValue(key, after, afterCtx)
    if (beforeVal === afterVal)
      continue
    changes.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      before: beforeVal,
      after: afterVal,
    })
  }

  const message = changes.length
    ? `Изменено мероприятие «${after.topic}» (ID ${after.id}): ${changes.length} полей`
    : `Изменено мероприятие «${after.topic}» (ID ${after.id}) без изменения полей`

  return {
    message,
    meta: { kind: 'event.update', changes },
  }
}

export function buildEventDeleteLog(
  event: EventRecord,
  context: EventLogContext,
): {
  message: string
  meta: { kind: 'event.delete'; fields: EventLogField[] }
} {
  const { meta } = buildEventCreateLog(event, context)
  return {
    message: `Удалено мероприятие «${event.topic}» (ID ${event.id})`,
    meta: { kind: 'event.delete', fields: meta.fields },
  }
}
