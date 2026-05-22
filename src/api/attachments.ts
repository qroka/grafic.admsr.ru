import { apiFetch, getAuthToken } from './client'
import { UPLOAD_MAX_SIZE_LABEL } from '../config/uploads'

export async function uploadEventAttachment(
  eventId: number,
  file: File,
): Promise<{ id: number, name: string, sizeLabel: string }> {
  const form = new FormData()
  form.append('file', file, file.name)

  const headers = new Headers()
  const token = getAuthToken()
  if (token)
    headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`/api/events/${eventId}/attachments`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    throw new Error(
      'Не удалось связаться с API. Запустите сервер: pnpm dev:server (или pnpm dev:all).',
    )
  }

  let data: {
    success?: boolean
    attachment?: { id: number, name: string, sizeLabel: string }
    error?: string
  }
  try {
    data = await response.json()
  } catch {
    throw new Error(
      response.status === 404
        ? 'Загрузка файлов недоступна — перезапустите API (pnpm dev:server).'
        : 'Не удалось загрузить файл',
    )
  }

  if (!response.ok || !data.success || !data.attachment) {
    if (response.status === 413) {
      throw new Error(
        data.error ?? `Файл слишком большой. Максимальный размер — ${UPLOAD_MAX_SIZE_LABEL}.`,
      )
    }
    throw new Error(data.error ?? 'Не удалось загрузить файл')
  }

  return data.attachment
}

export async function deleteEventAttachment(id: number): Promise<void> {
  await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' })
}

export async function fetchAttachmentBlob(
  id: number,
  download = false,
): Promise<Blob> {
  const headers = new Headers()
  const token = getAuthToken()
  if (token)
    headers.set('Authorization', `Bearer ${token}`)

  const q = download ? '?download=1' : ''
  const response = await fetch(`/api/attachments/${id}/file${q}`, { headers })
  if (!response.ok)
    throw new Error('Не удалось получить файл')

  return response.blob()
}

export async function downloadEventAttachment(
  id: number,
  filename: string,
): Promise<void> {
  const blob = await fetchAttachmentBlob(id, true)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function previewEventAttachment(id: number): Promise<void> {
  const blob = await fetchAttachmentBlob(id, false)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
