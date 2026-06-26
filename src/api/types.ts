export type ApiUserRole = 'admin' | 'manager' | 'moderator' | 'assistant' | 'user'

export interface ApiUser {
  id: number
  login: string
  name: string
  email: string | null
  role: ApiUserRole
  roleLabel?: string
  externalUserId: number | null
  substituteSlug: string | null
  editableSubstituteSlugs: string[]
}

export interface ApiCrmParticipant {
  id: number
  login: string
  name: string
  email?: string
  phone?: string
  ofo?: string
  avatar?: string
  line1?: string
  line2?: string
  address?: string
}

export interface ApiEventAttachment {
  id: number
  name: string
  sizeLabel: string
  mimeType?: string
  hasFile?: boolean
  redacted?: boolean
}

export interface ApiEvent {
  id: number
  substituteSlug: string
  eventDate: string
  time: string
  allDay: boolean
  placeLabel: string
  placeAddress: string
  topic: string
  hidden: boolean
  attachmentsHidden: boolean
  completed: boolean
  createdAt: string | null
  creatorExternalId: number | null
  attachmentsLabel: string
  detail: Record<string, unknown> | null
  participantIds: number[]
  attachments: ApiEventAttachment[]
  participants?: ApiCrmParticipant[]
  /** Создатель записи (кто создал мероприятие в графике). */
  creator?: ApiCrmParticipant | null
  /** Исполнитель: скрытое мероприятие — в графике только время. */
  viewRestricted?: boolean
  /** Исполнитель: скрытые файлы — в графике только количество. */
  attachmentsRestricted?: boolean
}

export interface ApiLoginResponse {
  success: boolean
  token?: string
  user?: ApiUser
  error?: string
}
