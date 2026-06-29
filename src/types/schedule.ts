export type ScheduleAccent = 'rose' | 'blue' | 'amber' | 'violet' | 'emerald'

export interface ScheduleAttachmentFile {
  id?: number
  name: string
  size: string
  /** Локальный файл до загрузки на сервер. */
  pendingFile?: File
  /** Содержимое скрыто для текущего пользователя. */
  redacted?: boolean
}

export interface ScheduleParticipant {
  externalId?: number
  /** Логин CRM — для сопоставления с записями журнала. */
  login?: string
  name: string
  avatarSrc: string
  card: {
    line1: string
    line2: string
    email: string
    phone: string
    address: string
  }
}

export interface ScheduleRowDetail {
  date?: string
  timeField?: string
  sorting?: string
  completed?: boolean
  allDay?: boolean
  createdAt?: string
  headerDateTime?: string
  /** Создатель мероприятия (не участник). */
  creator?: ScheduleParticipant
}

export interface ScheduleRow {
  apiId?: number
  time: string
  placeLabel: string
  placeAddress: string
  topic: string
  participants: ScheduleParticipant[]
  attachmentsLabel: string
  attachmentFiles: ScheduleAttachmentFile[]
  hidden?: boolean
  attachmentsHidden?: boolean
  /** Скрытое мероприятие для исполнителя — только время в списке. */
  viewRestricted?: boolean
  /** Скрытые файлы для исполнителя — в списке только количество. */
  attachmentsRestricted?: boolean
  detail?: ScheduleRowDetail
}

export const scheduleSubstituteSlugs = [
  'marcenkovskiy',
  'markova',
  'sidorov',
  'zhuravskaya',
  'nigmatullin',
] as const

export type ScheduleSubstituteSlug = (typeof scheduleSubstituteSlugs)[number]

export type ScheduleTitleValue = 'general' | ScheduleSubstituteSlug

export interface ScheduleUserGroup {
  name: string
  avatarSrc: string
  accent: ScheduleAccent
  substituteKey: ScheduleSubstituteSlug
  rows: ScheduleRow[]
}

export interface ScheduleDateBlock {
  id: string
  title: string
  defaultOpen: boolean
  groups: ScheduleUserGroup[]
  /** День в прошлом относительно сегодня. */
  isArchive?: boolean
}

export interface ScheduleDayEntry {
  group: ScheduleUserGroup
  row: ScheduleRow
}

export interface ScheduleDayBlockTitleParts {
  relativeDay: string
  date: string
  weekday: string
}
