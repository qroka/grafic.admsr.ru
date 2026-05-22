import { apiFetch } from './client'
import type { CrmPermissionKey, CrmUserPermissions } from '../constants/crm-user-fields'

export interface ApiCrmUser {
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

export interface CrmUsersMetaResponse {
  accessLevels: { value: number, label: string }[]
  activeLevels: { value: number, label: string }[]
  permissionModules: { key: CrmPermissionKey, label: string }[]
  deputies: { id: number, name: string }[]
  scheduleModule: { key: string, column: string, label: string }
}

export interface UpdateApiCrmUserPayload {
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

export type CreateApiCrmUserPayload = UpdateApiCrmUserPayload & {
  active: boolean
  login: string
  password: string
  name: string
}

export async function fetchCrmUsersMeta(): Promise<CrmUsersMetaResponse> {
  const res = await apiFetch<{
    success: boolean
    meta: Pick<CrmUsersMetaResponse, 'accessLevels' | 'activeLevels' | 'permissionModules'>
    deputies: CrmUsersMetaResponse['deputies']
    scheduleModule: CrmUsersMetaResponse['scheduleModule']
    permissionColumns: CrmUsersMetaResponse['permissionModules']
  }>('/api/crm-users/meta')
  return {
    accessLevels: res.meta.accessLevels,
    activeLevels: res.meta.activeLevels,
    permissionModules: res.permissionColumns ?? res.meta.permissionModules,
    deputies: res.deputies ?? [],
    scheduleModule: res.scheduleModule ?? {
      key: 'schedulePermission',
      column: 'u_prem9',
      label: 'График заместителей',
    },
  }
}

export async function fetchCrmUsers(search?: string): Promise<ApiCrmUser[]> {
  const q = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
  const res = await apiFetch<{ success: boolean, users: ApiCrmUser[] }>(
    `/api/crm-users${q}`,
  )
  return res.users ?? []
}

export async function createCrmUser(
  payload: CreateApiCrmUserPayload,
): Promise<ApiCrmUser> {
  const res = await apiFetch<{ success: boolean, user: ApiCrmUser }>(
    '/api/crm-users',
    { method: 'POST', body: JSON.stringify(payload) },
  )
  if (!res.user)
    throw new Error('Не удалось создать пользователя')
  return res.user
}

export async function updateCrmUser(
  id: number,
  payload: UpdateApiCrmUserPayload,
): Promise<ApiCrmUser> {
  const res = await apiFetch<{ success: boolean, user: ApiCrmUser }>(
    `/api/crm-users/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
  if (!res.user)
    throw new Error('Не удалось сохранить пользователя')
  return res.user
}
