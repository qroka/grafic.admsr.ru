/** Уровни прав (справочники $db_prem* / $db_active в legacy config.php). */
export const CRM_ACCESS_LEVELS = [
  { value: 0, label: 'Нет' },
  { value: 1, label: 'Просмотр' },
  { value: 2, label: 'Редактирование' },
] as const

export const CRM_ACTIVE_LEVELS = [
  { value: 0, label: 'Неактивен' },
  { value: 1, label: 'Активен' },
] as const

/** Порядок как в index.php (u_prem1 … u_prem8). */
export const CRM_PERMISSION_MODULES = [
  { key: 'headOrders', column: 'u_prem1', label: 'Поручения главы' },
  { key: 'headCalendar', column: 'u_prem2', label: 'График главы' },
  { key: 'eventsSchedule', column: 'u_prem3', label: 'График мероприятий' },
  { key: 'deputyOrders', column: 'u_prem4', label: 'Поручения заместителей' },
  { key: 'controlDocs', column: 'u_prem5', label: 'Контрольные документы' },
  { key: 'dumaChairSchedule', column: 'u_prem6', label: 'График председателя Думы' },
  { key: 'kspOrders', column: 'u_prem7', label: 'Поручения КСП' },
  { key: 'kspSchedule', column: 'u_prem8', label: 'График КСП' },
] as const

export type CrmPermissionKey = (typeof CRM_PERMISSION_MODULES)[number]['key']

export type CrmUserPermissions = Record<CrmPermissionKey, number>

export function emptyCrmPermissions(): CrmUserPermissions {
  return {
    headOrders: 0,
    headCalendar: 0,
    eventsSchedule: 0,
    deputyOrders: 0,
    controlDocs: 0,
    dumaChairSchedule: 0,
    kspOrders: 0,
    kspSchedule: 0,
  }
}

export function permissionsFromRow(row: Record<string, number>): CrmUserPermissions {
  const out = emptyCrmPermissions()
  for (const mod of CRM_PERMISSION_MODULES) {
    const v = row[mod.column]
    if (typeof v === 'number')
      out[mod.key] = v
  }
  return out
}

export function permissionLevelLabel(value: number): string {
  return CRM_ACCESS_LEVELS.find(l => l.value === value)?.label ?? String(value)
}

/** В списке пароль скрывается, если u_prem1 === 2 (как в index.php). */
export function shouldMaskPassword(permissions: CrmUserPermissions): boolean {
  return permissions.headOrders === 2
}
