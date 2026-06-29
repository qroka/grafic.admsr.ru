import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import { isScheduleSubstituteSlug, schedulePlacePresets } from '../config/schedule'
import type {
  ScheduleAttachmentFile,
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

export { schedulePlacePresets } from '../config/schedule'

export interface SchedulePlaceQuickOption {
  key: string
  label: string
  icon: string
  count?: number
  fromPreset?: boolean
}

export function normalizeSchedulePlaceKey(place: string): string {
  return place.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function guessSchedulePlaceIcon(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes('вкс') || lower.includes('видео') || lower.includes('skype'))
    return 'i-lucide-video'
  if (lower.includes('зал'))
    return 'i-lucide-presentation'
  if (lower.includes('каб'))
    return 'i-lucide-door-open'
  return 'i-lucide-map-pin'
}

function collectSchedulePlaceUsage(
  sources: Array<Pick<ScheduleRow, 'placeLabel' | 'placeAddress'>>,
): Map<string, { label: string, count: number }> {
  const variants = new Map<string, Map<string, number>>()

  for (const source of sources) {
    const label = formatSchedulePlace(source).trim().replace(/\s+/g, ' ')
    if (!label)
      continue
    const key = normalizeSchedulePlaceKey(label)
    const byLabel = variants.get(key) ?? new Map<string, number>()
    byLabel.set(label, (byLabel.get(label) ?? 0) + 1)
    variants.set(key, byLabel)
  }

  const result = new Map<string, { label: string, count: number }>()
  for (const [key, byLabel] of variants) {
    let bestLabel = ''
    let bestLabelCount = 0
    let total = 0
    for (const [label, count] of byLabel) {
      total += count
      if (count > bestLabelCount) {
        bestLabelCount = count
        bestLabel = label
      }
    }
    result.set(key, { label: bestLabel, count: total })
  }
  return result
}

/** Частые места: пресеты + реально используемые варианты из мероприятий. */
export function buildSchedulePlaceQuickOptions(
  sources: Array<Pick<ScheduleRow, 'placeLabel' | 'placeAddress'>>,
  options?: { extraLimit?: number, minExtraCount?: number },
): SchedulePlaceQuickOption[] {
  const extraLimit = options?.extraLimit ?? 8
  const minExtraCount = options?.minExtraCount ?? 2
  const usage = collectSchedulePlaceUsage(sources)
  const presetKeys = new Set(
    schedulePlacePresets.map(preset => normalizeSchedulePlaceKey(preset.label)),
  )

  const result: SchedulePlaceQuickOption[] = schedulePlacePresets.map((preset) => {
    const stats = usage.get(normalizeSchedulePlaceKey(preset.label))
    return {
      key: preset.value,
      label: preset.label,
      icon: preset.icon,
      count: stats?.count ?? 0,
      fromPreset: true,
    }
  })

  const extras = [...usage.entries()]
    .filter(([key]) => !presetKeys.has(key))
    .map(([, stats]) => stats)
    .filter(stats => stats.count >= minExtraCount)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))
    .slice(0, extraLimit)

  for (const stats of extras) {
    result.push({
      key: `usage-${normalizeSchedulePlaceKey(stats.label)}`,
      label: stats.label,
      icon: guessSchedulePlaceIcon(stats.label),
      count: stats.count,
    })
  }

  return result.sort((a, b) =>
    (b.count ?? 0) - (a.count ?? 0)
    || Number(Boolean(b.fromPreset)) - Number(Boolean(a.fromPreset))
    || a.label.localeCompare(b.label, 'ru'),
  )
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
    attachmentsHidden: false,
    detail: {
      date,
      allDay: false
    }
  }
}

/** Сдвиг даты ДД.ММ.ГГГГ на указанное число дней. */
export function addDaysToScheduleDate(dateStr: string, days: number): string | undefined {
  const parsed = parseScheduleDateString(dateStr)
  if (!parsed)
    return undefined
  const shifted = parsed.add({ days })
  return formatScheduleDateString(shifted)
}

/**
 * Копия мероприятия для создания новой записи: тема, место, участники, флаги.
 * Файлы не копируются; дата по умолчанию — через неделю от исходной.
 */
export function cloneScheduleRowForCopy(
  source: ScheduleRow,
  options?: { targetDate?: string },
): ScheduleRow {
  const sourceDate = source.detail?.date?.trim() ?? ''
  const targetDate = options?.targetDate
    ?? (sourceDate ? addDaysToScheduleDate(sourceDate, 7) : '')

  return {
    time: source.detail?.allDay ? '' : source.time,
    placeLabel: source.placeLabel,
    placeAddress: source.placeAddress,
    topic: source.topic,
    participants: source.participants.map(p => ({
      ...p,
      card: { ...p.card },
    })),
    attachmentsLabel: '',
    attachmentFiles: [],
    hidden: Boolean(source.hidden),
    attachmentsHidden: Boolean(source.attachmentsHidden),
    detail: {
      date: targetDate ?? '',
      allDay: Boolean(source.detail?.allDay),
      completed: false,
    },
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

/** Скрытые файлы без доступа: в графике видно количество, содержимое недоступно. */
export function isScheduleRowAttachmentsRestricted(row: ScheduleRow): boolean {
  return Boolean(row.attachmentsHidden && row.attachmentsRestricted)
}

/** Скрытые файлы с доступом: содержимое видно, но отмечено как скрытое для остальных. */
export function isScheduleRowAttachmentsHiddenForOthers(row: ScheduleRow): boolean {
  return Boolean(row.attachmentsHidden && !row.attachmentsRestricted)
}

export function isScheduleAttachmentRedacted(file: ScheduleAttachmentFile, row?: ScheduleRow): boolean {
  if (file.redacted)
    return true
  return row ? isScheduleRowAttachmentsRestricted(row) : false
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
  const relative = title.match(/^(Сегодня|Завтра|Послезавтра|Вчера|Позавчера)\s+(\d{2}\.\d{2}\.\d{4})\s+(.+)$/)
  if (relative)
    return { relativeDay: relative[1], date: relative[2], weekday: relative[3] }
  const plain = title.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+)$/)
  if (plain)
    return { relativeDay: plain[1], date: plain[1], weekday: plain[2] }
  return null
}

/** Сколько дней вперёд от сегодня показывать в графике. */
export const SCHEDULE_FUTURE_DAYS = 7

/** @deprecated Используйте SCHEDULE_FUTURE_DAYS */
export const SCHEDULE_VISIBLE_DAYS = SCHEDULE_FUTURE_DAYS

/** Сколько прошлых дней подгружать в режиме «Архив». */
export const SCHEDULE_ARCHIVE_PAST_DAYS = 30

/** Блоки архива: по одному на каждую прошлую дату, где есть мероприятия. */
export function buildArchiveBlocksFromEventDates(dateStrs: string[]): ScheduleDateBlock[] {
  const unique = [...new Set(dateStrs)].filter((dateStr) => {
    const parsed = parseScheduleDateString(dateStr)
    return parsed != null && dayOffsetFromToday(parsed) < 0
  })
  unique.sort((a, b) => compareScheduleDateStrings(b, a))

  const blocks = unique.map((dateStr, index) => {
    const block = buildScheduleDateBlock(parseScheduleDateString(dateStr)!)
    block.defaultOpen = index === 0
    return block
  })
  return blocks
}

export type ScheduleDateBlocksRange = {
  /** Дней в прошлом (относительно сегодня). */
  pastDays?: number
  /** Дней вперёд, включая сегодня. */
  futureDays?: number
  /** Перейти к дате: показать futureDays дней, начиная с этой даты (ДД.ММ.ГГГГ). */
  jumpStartDate?: string
}

export function scheduleBlockIdForDate(dateStr: string): string {
  return `date-${dateStr}`
}

/** Смещение даты относительно сегодня: -1 = вчера, 0 = сегодня, 1 = завтра. */
export function dayOffsetFromToday(date: CalendarDate): number {
  const t = today(getLocalTimeZone())
  if (date.compare(t) === 0)
    return 0

  let cursor = t
  let offset = 0
  if (date.compare(t) > 0) {
    while (cursor.compare(date) < 0) {
      cursor = cursor.add({ days: 1 })
      offset++
    }
    return offset
  }

  while (cursor.compare(date) > 0) {
    cursor = cursor.add({ days: -1 })
    offset--
  }
  return offset
}

export function findTodayScheduleBlock(
  blocks: ScheduleDateBlock[],
): ScheduleDateBlock | undefined {
  const todayStr = formatScheduleDateString(today(getLocalTimeZone()))
  return blocks.find(b => parseDateFromScheduleBlockTitle(b.title) === todayStr)
}

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

/** Заголовок блока дня: «Сегодня 18.05.2026 Вторник», «Вчера …» или «21.05.2026 Четверг». */
export function buildScheduleDayBlockTitle(date: CalendarDate): string {
  const dateStr = formatScheduleDateString(date)
  const weekday = weekdayNameRu(date)
  const offset = dayOffsetFromToday(date)
  if (offset === 0)
    return `Сегодня ${dateStr} ${weekday}`
  if (offset === 1)
    return `Завтра ${dateStr} ${weekday}`
  if (offset === 2)
    return `Послезавтра ${dateStr} ${weekday}`
  if (offset === -1)
    return `Вчера ${dateStr} ${weekday}`
  if (offset === -2)
    return `Позавчера ${dateStr} ${weekday}`
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
    || parts.relativeDay === 'Вчера'
    || parts.relativeDay === 'Позавчера'
  return {
    dayAndDate: isRelative ? `${parts.relativeDay} ${parts.date}` : parts.date,
    weekday: parts.weekday
  }
}

function compareScheduleDateStrings(a: string, b: string): number {
  const da = parseScheduleDateString(a)
  const db = parseScheduleDateString(b)
  if (!da || !db)
    return 0
  return da.compare(db)
}

function buildScheduleDateBlock(date: CalendarDate): ScheduleDateBlock {
  const offset = dayOffsetFromToday(date)
  const dateStr = formatScheduleDateString(date)
  return {
    id: scheduleBlockIdForDate(dateStr),
    title: buildScheduleDayBlockTitle(date),
    defaultOpen: offset >= 0 && offset <= 1,
    groups: [],
    isArchive: offset < 0,
  }
}

/** Блоки графика: по умолчанию сегодня + будущее; в режиме архива — только прошлые дни. */
export function createScheduleDateBlocks(
  range: ScheduleDateBlocksRange = {},
): ScheduleDateBlock[] {
  const futureDays = Math.max(1, range.futureDays ?? SCHEDULE_FUTURE_DAYS)
  const ref = today(getLocalTimeZone())

  if (range.jumpStartDate) {
    const jumpDate = parseScheduleDateString(range.jumpStartDate)
    if (!jumpDate)
      return createScheduleDateBlocks({ futureDays })
    const blocks: ScheduleDateBlock[] = []
    for (let i = 0; i < futureDays; i++) {
      const date = jumpDate.add({ days: i })
      if (dayOffsetFromToday(date) >= 0)
        break
      blocks.push(buildScheduleDateBlock(date))
    }
    if (blocks[0])
      blocks[0].defaultOpen = true
    return blocks
  }

  const currentAndFuture: ScheduleDateBlock[] = []
  for (let offset = 0; offset < futureDays; offset++)
    currentAndFuture.push(buildScheduleDateBlock(ref.add({ days: offset })))

  return currentAndFuture
}

/** Добавляет блок дня в список, если его ещё нет (уведомления, прошлые даты). */
export function ensureScheduleBlockForDate(
  blocks: ScheduleDateBlock[],
  dateStr: string,
): ScheduleDateBlock {
  const existingId = findScheduleBlockIdByDate(blocks, dateStr)
  if (existingId) {
    const found = blocks.find(b => b.id === existingId)
    if (found)
      return found
  }

  const parsed = parseScheduleDateString(dateStr)
  if (!parsed)
    throw new Error(`Некорректная дата: ${dateStr}`)

  const block = buildScheduleDateBlock(parsed)
  block.defaultOpen = true
  blocks.push(block)
  blocks.sort((a, b) => {
    const da = parseDateFromScheduleBlockTitle(a.title) ?? ''
    const db = parseDateFromScheduleBlockTitle(b.title) ?? ''
    const aArchive = a.isArchive ? 1 : 0
    const bArchive = b.isArchive ? 1 : 0
    if (aArchive !== bArchive)
      return aArchive - bArchive
    return compareScheduleDateStrings(da, db)
  })
  return block
}
