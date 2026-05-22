import { getDb } from '../db/sqlite.js'
import type { Env } from '../config/env.js'
import {
  buildStorageKey,
  deleteStoredFile,
  formatFileSizeLabel,
  saveUploadedFile,
} from '../services/file-storage.js'

export interface AttachmentRecord {
  id: number
  eventId: number
  name: string
  sizeLabel: string
  mimeType: string
  sizeBytes: number
  storageKey: string | null
}

function mapRow(row: {
  id: number
  event_id: number
  name: string
  size_label: string
  mime_type: string
  size_bytes: number
  storage_key: string | null
}): AttachmentRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    sizeLabel: row.size_label,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageKey: row.storage_key,
  }
}

export function listAttachmentsByEvent(eventId: number): AttachmentRecord[] {
  return getDb()
    .prepare(
      `SELECT id, event_id, name, size_label, mime_type, size_bytes, storage_key
       FROM event_attachments WHERE event_id = ? ORDER BY id`,
    )
    .all(eventId)
    .map(row => mapRow(row as Parameters<typeof mapRow>[0]))
}

export function findAttachmentById(id: number): AttachmentRecord | null {
  const row = getDb()
    .prepare(
      `SELECT id, event_id, name, size_label, mime_type, size_bytes, storage_key
       FROM event_attachments WHERE id = ?`,
    )
    .get(id) as Parameters<typeof mapRow>[0] | undefined
  return row ? mapRow(row) : null
}

function refreshEventAttachmentsLabel(eventId: number): void {
  const count = (
    getDb()
      .prepare('SELECT COUNT(*) AS c FROM event_attachments WHERE event_id = ?')
      .get(eventId) as { c: number }
  ).c

  let label = 'Нет файлов'
  if (count > 0) {
    const mod100 = count % 100
    const mod10 = count % 10
    if (mod100 > 10 && mod100 < 20)
      label = `${count} файлов`
    else if (mod10 === 1)
      label = `${count} файл`
    else if (mod10 >= 2 && mod10 <= 4)
      label = `${count} файла`
    else
      label = `${count} файлов`
  }

  getDb()
    .prepare('UPDATE events SET attachments_label = ? WHERE id = ?')
    .run(label, eventId)
}

export async function addAttachmentFromUpload(
  env: Env,
  eventId: number,
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<AttachmentRecord> {
  const storageKey = buildStorageKey(eventId, originalName)
  await saveUploadedFile(env, storageKey, buffer)

  const sizeBytes = buffer.length
  const sizeLabel = formatFileSizeLabel(sizeBytes)
  const result = getDb()
    .prepare(
      `INSERT INTO event_attachments (
        event_id, name, size_label, storage_key, mime_type, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(eventId, originalName, sizeLabel, storageKey, mimeType, sizeBytes)

  refreshEventAttachmentsLabel(eventId)

  return findAttachmentById(Number(result.lastInsertRowid))!
}

export async function deleteAttachment(env: Env, id: number): Promise<boolean> {
  const row = findAttachmentById(id)
  if (!row)
    return false

  await deleteStoredFile(env, row.storageKey)
  getDb().prepare('DELETE FROM event_attachments WHERE id = ?').run(id)
  refreshEventAttachmentsLabel(row.eventId)
  return true
}

export async function deleteAttachmentsForEvent(env: Env, eventId: number): Promise<void> {
  const rows = listAttachmentsByEvent(eventId)
  for (const row of rows)
    await deleteStoredFile(env, row.storageKey)
  getDb().prepare('DELETE FROM event_attachments WHERE event_id = ?').run(eventId)
  refreshEventAttachmentsLabel(eventId)
}
