import { createReadStream, existsSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { Env } from '../config/env.js'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
])

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.rtf',
  '.odt',
  '.ods',
  '.odp',
])

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

export function resolveUploadDir(env: Env): string {
  return resolve(serverRoot, env.UPLOAD_DIR)
}

export async function ensureUploadDir(env: Env): Promise<string> {
  const dir = resolveUploadDir(env)
  await mkdir(dir, { recursive: true })
  return dir
}

export function formatFileSizeLabel(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} Б`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function sanitizeBaseName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file'
  return base.slice(0, 180)
}

export function buildStorageKey(eventId: number, originalName: string): string {
  const ext = extname(originalName).slice(0, 16)
  const base = sanitizeBaseName(originalName.replace(extname(originalName), '') || 'file')
  return `${eventId}/${randomUUID()}_${base}${ext}`
}

export function assertAllowedUpload(mimeType: string, originalName: string): void {
  const ext = extname(originalName).toLowerCase()
  const mime = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''

  if (mime && ALLOWED_MIME_TYPES.has(mime))
    return

  if (ext && ALLOWED_EXTENSIONS.has(ext))
    return

  throw new UploadValidationError(
    'Недопустимый тип файла. Разрешены PDF, изображения, текст и документы Office.',
  )
}

export function assertSafeStoragePath(env: Env, storageKey: string): string {
  const root = resolveUploadDir(env)
  const fullPath = resolve(root, storageKey)
  const rel = relative(root, fullPath)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new UploadValidationError('Invalid storage path')
  }
  return fullPath
}

export function resolveStoredPath(env: Env, storageKey: string): string {
  return assertSafeStoragePath(env, storageKey)
}

export async function saveUploadedFile(
  env: Env,
  storageKey: string,
  buffer: Buffer,
): Promise<void> {
  const fullPath = assertSafeStoragePath(env, storageKey)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, buffer)
}

export async function deleteStoredFile(env: Env, storageKey: string | null): Promise<void> {
  if (!storageKey)
    return
  const fullPath = assertSafeStoragePath(env, storageKey)
  if (existsSync(fullPath))
    await unlink(fullPath).catch(() => undefined)
}

export function openStoredFile(env: Env, storageKey: string) {
  const fullPath = assertSafeStoragePath(env, storageKey)
  if (!existsSync(fullPath))
    return null
  return createReadStream(fullPath)
}
