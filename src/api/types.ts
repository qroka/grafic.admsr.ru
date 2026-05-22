export type ApiUserRole = 'admin' | 'manager' | 'moderator' | 'user'

export interface ApiUser {
  id: number
  login: string
  name: string
  email: string | null
  role: ApiUserRole
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
  completed: boolean
  createdAt: string | null
  organizerExternalId: number | null
  attachmentsLabel: string
  detail: Record<string, unknown> | null
  participantIds: number[]
  attachments: ApiEventAttachment[]
  participants?: ApiCrmParticipant[]
  organizer?: ApiCrmParticipant | null
}

export interface ApiLoginResponse {
  success: boolean
  token?: string
  user?: ApiUser
  error?: string
}
