import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import { isScheduleSubstituteSlug } from '../config/schedule'
import type {
  ScheduleDateBlock,
  ScheduleDayBlockTitleParts,
  ScheduleDayEntry,
  ScheduleParticipant,
  ScheduleRow,
  ScheduleTitleValue,
} from '../types/schedule'
export type { ScheduleDayBlockTitleParts, ScheduleDayEntry } from '../types/schedule'

/** Место одной строкой: населённый пункт и адрес через запятую. */
export function formatSchedulePlace(row: Pick<ScheduleRow, 'placeLabel' | 'placeAddress'>): string {
  return [row.placeLabel.trim(), row.placeAddress.trim()].filter(Boolean).join(', ')
}

export function parseScheduleSlugFromPath(path: string): ScheduleTitleValue {
  const clean = path.replace(/\/$/, '')
  const last = clean.split('/').pop() ?? ''
  if (isScheduleSubstituteSlug(last))
    return last
  return 'general'
}

export function filterScheduleBySubstitute(
  blocks: ScheduleDateBlock[],
  slug: ScheduleTitleValue
): ScheduleDateBlock[] {
  if (slug === 'general')
    return blocks
  return blocks.map(b => ({
    ...b,
    groups: b.groups.filter(g => g.substituteKey === slug)
  }))
}

export { findSubstituteGroup, ensureSubstituteGroup } from '../config/schedule'

export function buildScheduleDayBlockSelectOptions(blocks: ScheduleDateBlock[]) {
  return blocks.map((block) => {
    const parts = parseScheduleDayBlockTitle(block.title)
    return {
      label: parts ? `${parts.relativeDay} ${parts.date}` : block.title,
      value: block.id
    }
  })
}

/** ISO или «ДД.ММ.ГГГГ[, ЧЧ:ММ]» → подпись для шапки (время создания, не «весь день»). */
export function formatScheduleCreatedAtDisplay(
  value: string | null | undefined,
): string {
  if (!value?.trim())
    return ''
  const trimmed = value.trim()
  if (/^\d{2}\.\d{2}\.\d{4}/.test(trimmed))
    return trimmed
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : trimmed
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime()))
    return trimmed
  const dateStr = formatScheduleDateString(
    new CalendarDate(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate(),
    ),
  )
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${dateStr}, ${hours}:${minutes}`
}

/** «ДД.ММ.ГГГГ, ЧЧ:ММ» — момент создания записи (всегда с текущим временем). */
export function formatScheduleCreatedAtNow(): string {
  const now = new Date()
  const dateStr = formatScheduleDateString(
    new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
  )
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${dateStr}, ${hours}:${minutes}`
}

/** Заполняет `detail.createdAt`, если ещё нет (дата создания ≠ дата проведения). */
export function ensureScheduleRowDetailMeta(row: ScheduleRow, eventDateStr: string): void {
  const eventDate = parseScheduleDateString(eventDateStr)
  const allDay = row.detail?.allDay ?? false

  if (!row.detail) {
    row.detail = {
      date: eventDateStr,
      allDay
    }
  }
  else {
    row.detail.date = eventDateStr
    row.detail.allDay = allDay
  }

  if (row.apiId || row.detail.createdAt || row.detail.headerDateTime)
    return

  if (row.detail.sorting) {
    row.detail.createdAt = row.detail.sorting
    return
  }

  const createdDate = eventDate
    ? eventDate.subtract({ days: 1 })
    : today(getLocalTimeZone())

  if (allDay) {
    row.detail.createdAt = formatScheduleDateString(createdDate)
    return
  }

  const time = row.time.trim().match(/^\d{1,2}:\d{2}$/) ? row.time.trim() : '09:00'
  row.detail.createdAt = `${formatScheduleDateString(createdDate)}, ${time}`
}

/** Подпись под заголовком «Мероприятие» (дата создания, не проведения). */
export function getScheduleRowCreatedAt(row: ScheduleRow): string {
  const detail = row.detail
  if (!detail)
    return ''
  const raw = detail.createdAt ?? detail.headerDateTime ?? detail.sorting ?? ''
  return formatScheduleCreatedAtDisplay(raw)
}

/** Время по умолчанию для нового мероприятия: текущее, округлённое вверх до 5 минут. */
export function defaultScheduleEventTime(date = new Date()): string {
  let hours = date.getHours()
  let minutes = date.getMinutes()
  const remainder = minutes % 5
  if (remainder !== 0)
    minutes += 5 - remainder
  if (minutes >= 60) {
    minutes -= 60
    hours = (hours + 1) % 24
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Пустая строка для формы «Новое мероприятие». */
export function createEmptyScheduleRow(blockDate?: string): ScheduleRow {
  const date = blockDate ?? ''
  return {
    time: defaultScheduleEventTime(),
    placeLabel: '',
    placeAddress: '',
    topic: '',
    participants: [],
    attachmentsLabel: '',
    attachmentFiles: [],
    hidden: false,
    detail: {
      date,
      allDay: false
    }
  }
}

/** Уникальный ключ участника (для фильтра и выбора). */
export function scheduleParticipantKey(participant: ScheduleParticipant): string {
  return participant.externalId != null
    ? String(participant.externalId)
    : participant.name
}

/** Скрытое мероприятие без доступа к деталям: в графике только время и плашка. */
export function isScheduleRowViewRestricted(row: ScheduleRow): boolean {
  return Boolean(row.hidden && row.viewRestricted)
}

/** Сокращённое ФИО для таблицы: «Иванов И.И.» (фамилия + инициалы). */
export function formatParticipantShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length)
    return ''
  if (parts.length === 1)
    return parts[0]!
  const surname = parts[0]!
  const initials = parts
    .slice(1)
    .map(part => `${part.charAt(0).toUpperCase()}.`)
    .join('')
  return `${surname} ${initials}`
}

/** Инициалы для компактного отображения: «Иванов Иван Иванович» → «ИИ». */
export function formatParticipantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length)
    return '?'
  if (parts.length === 1) {
    const word = parts[0]!
    return word.length >= 2
      ? word.slice(0, 2).toUpperCase()
      : word.charAt(0).toUpperCase()
  }
  if (parts.length === 2)
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
  return (parts[1]!.charAt(0) + parts[2]!.charAt(0)).toUpperCase()
}

/** Пропсы для UAvatar / UButton / USelectMenu — только инициалы, без фото. */
export function personAvatarChip(name: string) {
  const label = name.trim() || 'Пользователь'
  return {
    alt: label,
    text: formatParticipantInitials(label),
  }
}

export function formatAttachmentFileSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} Б`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

const scheduleAttachmentDisplaySize = new WeakMap<File, string>()

const SCHEDULE_ATTACHMENT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav'
}

export function mimeFromScheduleFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return SCHEDULE_ATTACHMENT_MIME[ext] ?? 'application/octet-stream'
}

/** Метаданные вложения → File для отображения в UFileUpload. */
export function scheduleAttachmentToFile(meta: { name: string, size: string }): File {
  const file = new File([], meta.name, {
    type: mimeFromScheduleFileName(meta.name),
    lastModified: Date.now()
  })
  scheduleAttachmentDisplaySize.set(file, meta.size)
  return file
}

export function scheduleFilesFromAttachments(
  items: { name: string, size: string }[]
): File[] {
  return items.map(scheduleAttachmentToFile)
}

/** Подпись размера в списке файлов (демо или реальная загрузка). */
export function scheduleFileDisplaySize(file: File): string {
  const saved = scheduleAttachmentDisplaySize.get(file)
  if (saved)
    return saved
  return formatAttachmentFileSize(file.size)
}

export function scheduleAttachmentsFromFiles(files: File[]): { name: string, size: string }[] {
  return files.map(file => ({
    name: file.name,
    size: scheduleFileDisplaySize(file)
  }))
}

function triggerFileDownload(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadScheduleAttachment(meta: { name: string, size: string }) {
  triggerFileDownload(scheduleAttachmentToFile(meta))
}

export function downloadScheduleFile(file: File) {
  triggerFileDownload(file)
}

export function previewScheduleFile(file: File) {
  const url = URL.createObjectURL(file)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function previewScheduleAttachment(meta: { name: string, size: string }) {
  previewScheduleFile(scheduleAttachmentToFile(meta))
}

export function formatAttachmentsLabel(count: number): string {
  if (count === 0)
    return 'Нет файлов'
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 > 10 && mod100 < 20)
    return `${count} файлов`
  if (mod10 === 1)
    return `${count} файл`
  if (mod10 >= 2 && mod10 <= 4)
    return `${count} файла`
  return `${count} файлов`
}

/** Все уникальные участники из блоков графика, отсортированные по ФИО. */
export function collectScheduleParticipants(blocks: ScheduleDateBlock[]): ScheduleParticipant[] {
  const byKey = new Map<string, ScheduleParticipant>()
  for (const block of blocks) {
    for (const group of block.groups) {
      for (const row of group.rows) {
        for (const participant of row.participants)
          byKey.set(scheduleParticipantKey(participant), participant)
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

export function scheduleRowMatchesFilters(
  row: ScheduleRow,
  query: string,
  participantKeys: string[]
): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length) {
    const haystack = [
      row.topic,
      row.placeLabel,
      row.placeAddress,
      formatSchedulePlace(row),
      formatScheduleRowTime(row),
      row.time,
      row.attachmentsLabel,
      ...row.attachmentFiles.map(f => f.name),
      ...row.participants.map(p => p.name),
      row.detail?.creator?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!terms.every(term => haystack.includes(term)))
      return false
  }

  if (participantKeys.length > 0) {
    const rowParticipantKeys = new Set(
      row.participants.map(scheduleParticipantKey),
    )
    if (!participantKeys.some(key => rowParticipantKeys.has(key)))
      return false
  }

  return true
}

/** Минуты с полуночи из строки «ЧЧ:ММ». */
export function parseScheduleRowTimeMinutes(time: string): number {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m)
    return 0
  return Number(m[1]) * 60 + Number(m[2])
}

export const SCHEDULE_ALL_DAY_LABEL = 'Весь день'

export function isScheduleRowAllDay(row: ScheduleRow): boolean {
  return Boolean(row.detail?.allDay)
}

/** Время в списке/доске: «Весь день» или «ЧЧ:ММ». */
export function formatScheduleRowTime(row: ScheduleRow): string {
  return isScheduleRowAllDay(row) ? SCHEDULE_ALL_DAY_LABEL : row.time
}

/** Сортировка: мероприятия на весь день — в начале дня. */
export function scheduleRowSortMinutes(row: ScheduleRow): number {
  if (isScheduleRowAllDay(row))
    return -1
  return parseScheduleRowTimeMinutes(row.time)
}

/** Все мероприятия дня, отсортированные по времени (не по руководителю). */
export function collectBlockEntriesSortedByTime(block: ScheduleDateBlock): ScheduleDayEntry[] {
  const entries: ScheduleDayEntry[] = block.groups.flatMap(group =>
    group.rows.map(row => ({ group, row }))
  )
  return entries.sort(
    (a, b) => scheduleRowSortMinutes(a.row) - scheduleRowSortMinutes(b.row)
  )
}

export function scheduleBlockHasRows(block: ScheduleDateBlock): boolean {
  return block.groups.some(group => group.rows.length > 0)
}

/** Фильтр строк внутри дней; пустые группы и дни без мероприятий убираются. */
export function filterScheduleBlocks(
  blocks: ScheduleDateBlock[],
  query: string,
  participantKeys: string[]
): ScheduleDateBlock[] {
  return blocks
    .map(block => ({
      ...block,
      groups: block.groups
        .map(group => ({
          ...group,
          rows: group.rows.filter(row =>
            scheduleRowMatchesFilters(row, query, participantKeys)
          ),
        }))
        .filter(group => group.rows.length > 0),
    }))
    .filter(scheduleBlockHasRows)
}

export function schedulePathForSlug(slug: ScheduleTitleValue): string {
  if (slug === 'general')
    return '/'
  return `/${slug}`
}

/** Первая дата вида ДД.ММ.ГГГГ из заголовка дня, напр. «Сегодня 12.05.2025 Вторник». */
export function parseDateFromScheduleBlockTitle(title: string): string | undefined {
  const m = title.match(/(\d{2}\.\d{2}\.\d{4})/)
  return m?.[1]
}

/** Строка ДД.ММ.ГГГГ → CalendarDate. */
export function parseScheduleDateString(value: string): CalendarDate | undefined {
  const m = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m)
    return undefined
  return new CalendarDate(Number(m[3]), Number(m[2]), Number(m[1]))
}

/** CalendarDate → строка ДД.ММ.ГГГГ. */
export function formatScheduleDateString(date: CalendarDate | DateValue): string {
  const d = date instanceof CalendarDate ? date : new CalendarDate(date.year, date.month, date.day)
  const day = String(d.day).padStart(2, '0')
  const month = String(d.month).padStart(2, '0')
  return `${day}.${month}.${d.year}`
}

/** Id блока дня по дате ДД.ММ.ГГГГ. */
export function findScheduleBlockIdByDate(
  blocks: ScheduleDateBlock[],
  dateStr: string
): string | undefined {
  for (const block of blocks) {
    if (parseDateFromScheduleBlockTitle(block.title) === dateStr)
      return block.id
  }
  return undefined
}

export function parseScheduleDayBlockTitle(title: string): ScheduleDayBlockTitleParts | null {
  const relative = title.match(/^(Сегодня|Завтра|Послезавтра)\s+(\d{2}\.\d{2}\.\d{4})\s+(.+)$/)
  if (relative)
    return { relativeDay: relative[1], date: relative[2], weekday: relative[3] }
  const plain = title.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+)$/)
  if (plain)
    return { relativeDay: plain[1], date: plain[1], weekday: plain[2] }
  return null
}

/** Сколько дней подряд показывать в графике (первый — всегда сегодня). */
export const SCHEDULE_VISIBLE_DAYS = 7

const WEEKDAY_NAMES_RU = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота'
] as const

function weekdayNameRu(date: CalendarDate): string {
  const jsDay = new Date(date.year, date.month - 1, date.day).getDay()
  return WEEKDAY_NAMES_RU[jsDay]!
}

/** Заголовок блока дня: «Сегодня 18.05.2026 Вторник» или «21.05.2026 Четверг». */
export function buildScheduleDayBlockTitle(date: CalendarDate, dayOffset: number): string {
  const dateStr = formatScheduleDateString(date)
  const weekday = weekdayNameRu(date)
  if (dayOffset === 0)
    return `Сегодня ${dateStr} ${weekday}`
  if (dayOffset === 1)
    return `Завтра ${dateStr} ${weekday}`
  if (dayOffset === 2)
    return `Послезавтра ${dateStr} ${weekday}`
  return `${dateStr} ${weekday}`
}

/** Подпись в шапке колонки/секции списка. */
export function buildScheduleDayBlockHeading(title: string): {
  dayAndDate: string
  weekday: string
} | null {
  const parts = parseScheduleDayBlockTitle(title)
  if (!parts)
    return null
  const isRelative = parts.relativeDay === 'Сегодня'
    || parts.relativeDay === 'Завтра'
    || parts.relativeDay === 'Послезавтра'
  return {
    dayAndDate: isRelative ? `${parts.relativeDay} ${parts.date}` : parts.date,
    weekday: parts.weekday
  }
}

/** Блоки графика: каждый день подряд, первый — сегодня (без мероприятий — подгружаются с API). */
export function createScheduleDateBlocks(
  referenceDate: CalendarDate = today(getLocalTimeZone())
): ScheduleDateBlock[] {
  const blocks: ScheduleDateBlock[] = []
  for (let offset = 0; offset < SCHEDULE_VISIBLE_DAYS; offset++) {
    const date = referenceDate.add({ days: offset })
    blocks.push({
      id: `day-${offset}`,
      title: buildScheduleDayBlockTitle(date, offset),
      defaultOpen: offset <= 2,
      groups: [],
    })
  }
  return blocks
}
