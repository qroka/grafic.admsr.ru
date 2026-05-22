export interface EventAttachmentRow {
  id: number
  name: string
  sizeLabel: string
  mimeType: string
  hasFile: boolean
}

export interface EventRecord {
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
  attachments: EventAttachmentRow[]
}

export interface CreateEventInput {
  substituteSlug: string
  eventDate: string
  time?: string
  allDay?: boolean
  placeLabel?: string
  placeAddress?: string
  topic: string
  hidden?: boolean
  completed?: boolean
  createdAt?: string
  organizerExternalId?: number | null
  detail?: Record<string, unknown> | null
  participantIds?: number[]
}

export type UpdateEventInput = Partial<CreateEventInput>
