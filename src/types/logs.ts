export type ActivityLogLevel = 'info' | 'success' | 'warning' | 'error'

export type ActivityLogScope = 'business' | 'system'

export type ActivityLogCategory =
  | 'auth'
  | 'event'
  | 'attachment'
  | 'participant'
  | 'system'

export interface ActivityLogEventField {
  key: string
  label: string
  value: string
}

export interface ActivityLogEventChange {
  key: string
  label: string
  before: string
  after: string
}

export interface ActivityLogMeta {
  kind?:
    | 'event.create'
    | 'event.update'
    | 'event.delete'
    | 'attachment.upload'
    | 'attachment.delete'
    | 'attachment.upload_failed'
  fields?: ActivityLogEventField[]
  changes?: ActivityLogEventChange[]
  /** Имена прикреплённых файлов (загрузка / удаление) */
  files?: string[]
}

export interface ActivityLogEntry {
  id: number
  /** ISO 8601 или SQLite datetime */
  createdAt: string
  level: ActivityLogLevel
  category: ActivityLogCategory
  /** Код действия, напр. `event.create` */
  action: string
  message: string
  userLogin?: string
  userName?: string
  entityType?: string
  entityId?: number
  ipAddress?: string
  meta?: ActivityLogMeta | null
}
