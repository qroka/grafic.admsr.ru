export type CrmPermissionKey =
  | 'headOrders'
  | 'headCalendar'
  | 'eventsSchedule'
  | 'deputyOrders'
  | 'controlDocs'
  | 'dumaChairSchedule'
  | 'kspOrders'
  | 'kspSchedule'

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

export function formatPermissionSummary(
  permissions: CrmUserPermissions,
  modules: { key: CrmPermissionKey, label: string }[],
  levelLabel: (value: number) => string,
): string[] {
  return modules
    .filter(m => (permissions[m.key] ?? 0) > 0)
    .map(m => `${m.label}: ${levelLabel(permissions[m.key])}`)
}
