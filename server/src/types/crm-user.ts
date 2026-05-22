import type { CrmUserPermissions } from '../constants/crm-user-fields.js'

export interface CrmUserRecord {
  id: number
  active: boolean
  login: string
  password: string
  passwordMasked: boolean
  name: string
  email: string
  phone: string
  office: string
  position: string
  info: string
  notes: string
  schedulePermission: boolean
  isDeputy: boolean
  deputyId: number
  permissions: CrmUserPermissions
}

export interface CrmUserDeputyOption {
  id: number
  name: string
}

export interface CrmUsersMeta {
  accessLevels: { value: number, label: string }[]
  activeLevels: { value: number, label: string }[]
  permissionModules: { key: string, label: string }[]
}

export interface UpdateCrmUserInput {
  active?: boolean
  login?: string
  password?: string
  name?: string
  email?: string
  phone?: string
  office?: string
  position?: string
  info?: string
  notes?: string
  schedulePermission?: boolean
  isDeputy?: boolean
  deputyId?: number
  permissions?: Partial<CrmUserPermissions>
}

export interface CreateCrmUserInput {
  active: boolean
  login: string
  password: string
  name: string
  email?: string
  phone?: string
  office?: string
  position?: string
  info?: string
  notes?: string
  schedulePermission?: boolean
  isDeputy?: boolean
  deputyId?: number
  permissions?: Partial<CrmUserPermissions>
}
