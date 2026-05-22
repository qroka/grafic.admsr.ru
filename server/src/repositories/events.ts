import type { Env } from '../config/env.js'
import { getDb } from '../db/sqlite.js'
import {
  deleteAttachmentsForEvent,
  listAttachmentsByEvent,
} from './attachments.js'
import type {
  CreateEventInput,
  EventRecord,
  UpdateEventInput,
} from '../types/events.js'

interface EventRow {
  id: number
  substitute_slug: string
  event_date: string
  time: string
  all_day: number
  place_label: string
  place_address: string
  topic: string
  hidden: number
  completed: number
  created_at: string | null
  organizer_external_id: number | null
  attachments_label: string
  detail_json: string | null
}

function parseDetail(json: string | null): Record<string, unknown> | null {
  if (!json)
    return null
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function loadParticipantIds(eventId: number): number[] {
  return getDb()
    .prepare(
      `SELECT external_user_id FROM event_participants WHERE event_id = ? ORDER BY external_user_id`,
    )
    .all(eventId)
    .map(row => (row as { external_user_id: number }).external_user_id)
}

function mapEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    substituteSlug: row.substitute_slug,
    eventDate: row.event_date,
    time: row.time,
    allDay: row.all_day === 1,
    placeLabel: row.place_label,
    placeAddress: row.place_address,
    topic: row.topic,
    hidden: row.hidden === 1,
    completed: row.completed === 1,
    createdAt: row.created_at,
    organizerExternalId: row.organizer_external_id,
    attachmentsLabel: row.attachments_label,
    detail: parseDetail(row.detail_json),
    participantIds: loadParticipantIds(row.id),
    attachments: listAttachmentsByEvent(row.id).map(a => ({
      id: a.id,
      name: a.name,
      sizeLabel: a.sizeLabel,
      mimeType: a.mimeType,
      hasFile: Boolean(a.storageKey),
    })),
  }
}

function setParticipants(eventId: number, participantIds: number[]): void {
  const db = getDb()
  db.prepare('DELETE FROM event_participants WHERE event_id = ?').run(eventId)
  const insert = db.prepare(
    'INSERT INTO event_participants (event_id, external_user_id) VALUES (?, ?)',
  )
  for (const externalUserId of [...new Set(participantIds)]) {
    insert.run(eventId, externalUserId)
  }
}

export function listEvents(filters?: {
  eventDate?: string
  substituteSlug?: string
}): EventRecord[] {
  const clauses: string[] = []
  const params: string[] = []

  if (filters?.eventDate) {
    clauses.push('event_date = ?')
    params.push(filters.eventDate)
  }
  if (filters?.substituteSlug) {
    clauses.push('substitute_slug = ?')
    params.push(filters.substituteSlug)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = getDb()
    .prepare(`SELECT * FROM events ${where} ORDER BY event_date, time, id`)
    .all(...params) as EventRow[]

  return rows.map(mapEvent)
}

export function findEventById(id: number): EventRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(id) as EventRow | undefined
  return row ? mapEvent(row) : null
}

export function createEvent(input: CreateEventInput): EventRecord {
  const db = getDb()
  const insert = db
    .prepare(
      `INSERT INTO events (
        substitute_slug, event_date, time, all_day,
        place_label, place_address, topic, hidden, completed,
        created_at, organizer_external_id, attachments_label, detail_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.substituteSlug,
      input.eventDate,
      input.time ?? '09:00',
      input.allDay ? 1 : 0,
      input.placeLabel ?? '',
      input.placeAddress ?? '',
      input.topic,
      input.hidden ? 1 : 0,
      input.completed ? 1 : 0,
      input.createdAt ?? new Date().toISOString(),
      input.organizerExternalId ?? null,
      'Нет файлов',
      input.detail ? JSON.stringify(input.detail) : null,
    )

  const eventId = Number(insert.lastInsertRowid)
  if (input.participantIds?.length)
    setParticipants(eventId, input.participantIds)

  return findEventById(eventId)!
}

export function updateEvent(id: number, input: UpdateEventInput): EventRecord | null {
  const existing = findEventById(id)
  if (!existing)
    return null

  const db = getDb()
  db.prepare(
    `UPDATE events SET
      substitute_slug = ?,
      event_date = ?,
      time = ?,
      all_day = ?,
      place_label = ?,
      place_address = ?,
      topic = ?,
      hidden = ?,
      completed = ?,
      created_at = ?,
      organizer_external_id = ?,
      detail_json = ?
    WHERE id = ?`,
  ).run(
    input.substituteSlug ?? existing.substituteSlug,
    input.eventDate ?? existing.eventDate,
    input.time ?? existing.time,
    (input.allDay ?? existing.allDay) ? 1 : 0,
    input.placeLabel ?? existing.placeLabel,
    input.placeAddress ?? existing.placeAddress,
    input.topic ?? existing.topic,
    (input.hidden ?? existing.hidden) ? 1 : 0,
    (input.completed ?? existing.completed) ? 1 : 0,
    input.createdAt ?? existing.createdAt,
    input.organizerExternalId !== undefined
      ? input.organizerExternalId
      : existing.organizerExternalId,
    input.detail !== undefined
      ? (input.detail ? JSON.stringify(input.detail) : null)
      : (existing.detail ? JSON.stringify(existing.detail) : null),
    id,
  )

  if (input.participantIds)
    setParticipants(id, input.participantIds)

  return findEventById(id)
}

export async function deleteEvent(env: Env, id: number): Promise<boolean> {
  const existing = findEventById(id)
  if (!existing)
    return false

  await deleteAttachmentsForEvent(env, id)
  const result = getDb().prepare('DELETE FROM events WHERE id = ?').run(id)
  return result.changes > 0
}
