import { ref } from 'vue'
import {
  deleteEventAttachment,
  uploadEventAttachment,
} from '../api/attachments'
import { apiFetch } from '../api/client'
import {
  apiEventToScheduleRow,
  buildArchiveBlocksFromEvents,
  mergeEventsIntoBlocks,
  scheduleRowToApiPayload,
} from '../api/schedule-mapper'
import type { ApiEvent } from '../api/types'
import type {
  ScheduleAttachmentFile,
  ScheduleDateBlock,
  ScheduleRow,
  ScheduleUserGroup,
} from '../types/schedule'
import { assertUploadFilesValid } from '../config/uploads'
import {
  createScheduleDateBlocks,
  parseDateFromScheduleBlockTitle,
  type ScheduleDateBlocksRange,
} from '../utils/schedule'

function pendingUploadFiles(attachments: ScheduleAttachmentFile[]): File[] {
  return attachments
    .map(f => f.pendingFile)
    .filter((f): f is File => f instanceof File)
}

function attachmentKey(file: ScheduleAttachmentFile): string {
  return file.id != null ? `id:${file.id}` : `pending:${file.name}:${file.size}`
}

export async function syncEventAttachments(
  eventId: number,
  current: ScheduleAttachmentFile[],
  previous: ScheduleAttachmentFile[],
): Promise<void> {
  const previousIds = new Set(
    previous.filter(f => f.id != null).map(f => f.id!),
  )
  const currentIds = new Set(
    current.filter(f => f.id != null).map(f => f.id!),
  )

  for (const id of previousIds) {
    if (!currentIds.has(id))
      await deleteEventAttachment(id)
  }

  const existingKeys = new Set(
    previous.filter(f => !f.pendingFile).map(attachmentKey),
  )

  for (const file of current) {
    if (!file.pendingFile)
      continue
    if (existingKeys.has(attachmentKey(file)))
      continue
    await uploadEventAttachment(eventId, file.pendingFile)
  }
}

export function useScheduleApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const events = ref<ApiEvent[]>([])

  async function loadBlocks(range?: ScheduleDateBlocksRange): Promise<ScheduleDateBlock[]> {
    loading.value = true
    error.value = null
    try {
      const res = await apiFetch<{ success: boolean, events: ApiEvent[] }>('/api/events')
      events.value = res.events

      if (range?.jumpStartDate) {
        const blocks = createScheduleDateBlocks(range)
        mergeEventsIntoBlocks(blocks, res.events)
        return blocks
      }

      if ((range?.pastDays ?? 0) > 0) {
        const blocks = buildArchiveBlocksFromEvents(res.events)
        mergeEventsIntoBlocks(blocks, res.events)
        return blocks
      }

      const blocks = createScheduleDateBlocks(range ?? {})
      mergeEventsIntoBlocks(blocks, res.events)
      return blocks
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить график'
      return createScheduleDateBlocks(range ?? {})
    } finally {
      loading.value = false
    }
  }

  async function saveEvent(
    row: ScheduleRow,
    group: ScheduleUserGroup,
    block: ScheduleDateBlock,
    isCreate: boolean,
    previousAttachments: ScheduleAttachmentFile[] = [],
  ): Promise<ScheduleRow> {
    const eventDate = row.detail?.date
      ?? parseDateFromScheduleBlockTitle(block.title)
    if (!eventDate)
      throw new Error('Не указана дата мероприятия')

    const payload = scheduleRowToApiPayload(row, group.substituteKey, eventDate, {
      isCreate: isCreate || !row.apiId,
    })
    const attachmentsToSync = [...row.attachmentFiles]
    assertUploadFilesValid(pendingUploadFiles(attachmentsToSync))

    if (isCreate || !row.apiId) {
      const res = await apiFetch<{ success: boolean, event: ApiEvent }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const saved = apiEventToScheduleRow(res.event)
      const eventId = saved.apiId!
      try {
        await syncEventAttachments(eventId, attachmentsToSync, previousAttachments)
      } catch (uploadError) {
        try {
          await apiFetch(`/api/events/${eventId}`, { method: 'DELETE' })
        } catch {
          /* откат при сбое загрузки */
        }
        throw uploadError
      }
      const created = await apiFetch<{ success: boolean, event: ApiEvent }>(
        `/api/events/${eventId}`,
      ).catch(() => res)
      return apiEventToScheduleRow(created.event ?? res.event)
    }

    const patchRes = await apiFetch<{ success: boolean, event: ApiEvent }>(
      `/api/events/${row.apiId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    )
    if (!patchRes.event)
      throw new Error('Не удалось сохранить мероприятие')
    await syncEventAttachments(row.apiId, attachmentsToSync, previousAttachments)
    const refreshed = await apiFetch<{ success: boolean, event: ApiEvent }>(
      `/api/events/${row.apiId}`,
    )
    return apiEventToScheduleRow(refreshed.event ?? patchRes.event)
  }

  async function deleteEvent(row: ScheduleRow): Promise<void> {
    if (!row.apiId)
      return
    await apiFetch(`/api/events/${row.apiId}`, { method: 'DELETE' })
  }

  return {
    loading,
    error,
    events,
    loadBlocks,
    saveEvent,
    deleteEvent,
  }
}
