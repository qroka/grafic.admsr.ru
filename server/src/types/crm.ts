/** Участник из CRM (MySQL corporate.users на 172.17.30.42). */
export interface CrmParticipant {
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

export interface CrmParticipantsListResponse {
  success: true
  participants: CrmParticipant[]
}
