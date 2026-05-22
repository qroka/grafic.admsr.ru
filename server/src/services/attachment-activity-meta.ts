import type { EventLogField } from './event-activity-meta.js'

export function buildAttachmentUploadMeta(
  fileName: string,
  sizeLabel: string,
  eventTopic: string,
  eventId: number,
): { message: string, meta: { kind: 'attachment.upload', fields: EventLogField[], files: string[] } } {
  const fields: EventLogField[] = [
    { key: 'fileName', label: 'Файл', value: fileName },
    { key: 'size', label: 'Размер', value: sizeLabel },
    { key: 'event', label: 'Мероприятие', value: `«${eventTopic}» (ID ${eventId})` },
  ]
  return {
    message: `Загружен файл «${fileName}» к мероприятию «${eventTopic}»`,
    meta: {
      kind: 'attachment.upload',
      fields,
      files: [fileName],
    },
  }
}

export function buildAttachmentDeleteMeta(
  fileName: string,
  eventTopic: string | null,
  eventId: number | null,
): { message: string, meta: { kind: 'attachment.delete', fields: EventLogField[], files: string[] } } {
  const eventValue = eventTopic && eventId != null
    ? `«${eventTopic}» (ID ${eventId})`
    : (eventId != null ? `ID ${eventId}` : '—')

  const fields: EventLogField[] = [
    { key: 'fileName', label: 'Файл', value: fileName },
    { key: 'event', label: 'Мероприятие', value: eventValue },
  ]
  return {
    message: `Удалён файл «${fileName}»`,
    meta: {
      kind: 'attachment.delete',
      fields,
      files: [fileName],
    },
  }
}

export function buildAttachmentUploadFailedMeta(
  fileName: string | undefined,
  eventTopic: string | null,
  eventId: number | null,
): { message: string, meta: { kind: 'attachment.upload_failed', fields: EventLogField[], files: string[] } } {
  const name = fileName?.trim() || '—'
  const fields: EventLogField[] = [
    { key: 'fileName', label: 'Файл', value: name },
  ]
  if (eventTopic && eventId != null) {
    fields.push({
      key: 'event',
      label: 'Мероприятие',
      value: `«${eventTopic}» (ID ${eventId})`,
    })
  }
  return {
    message: fileName
      ? `Не удалось загрузить файл «${fileName}»: превышен лимит размера`
      : 'Не удалось загрузить файл: превышен лимит размера',
    meta: {
      kind: 'attachment.upload_failed',
      fields,
      files: fileName ? [fileName] : [],
    },
  }
}
