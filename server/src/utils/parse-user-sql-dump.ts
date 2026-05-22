import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyCrmPermissions, shouldMaskPassword } from '../constants/crm-user-fields.js'
import type { CrmUserPermissions } from '../constants/crm-user-fields.js'
import type { CrmUserRecord } from '../types/crm-user.js'

const dumpPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../db/reference/user.sql',
)

let cached: CrmUserRecord[] | null = null

/** Парсит строки INSERT из phpMyAdmin-дампа `user.sql` (dev / CRM_MOCK). */
export function loadCrmUsersFromSqlDump(): CrmUserRecord[] {
  if (cached)
    return cached

  const content = readFileSync(dumpPath, 'utf8')
  const users: CrmUserRecord[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('('))
      continue

    const fields = parseSqlTupleFields(trimmed)
    const user = mapUserFields(fields)
    if (user)
      users.push(user)
  }

  cached = users.sort((a, b) => {
    if (a.active !== b.active)
      return a.active ? -1 : 1
    return a.name.localeCompare(b.name, 'ru')
  })
  return cached
}

function permissionsFromPremSlice(values: number[]): CrmUserPermissions {
  const perms = emptyCrmPermissions()
  const keys = [
    'headOrders',
    'headCalendar',
    'eventsSchedule',
    'deputyOrders',
    'controlDocs',
    'dumaChairSchedule',
    'kspOrders',
    'kspSchedule',
  ] as const
  keys.forEach((key, i) => {
    perms[key] = values[i] ?? 0
  })
  return perms
}

function mapUserFields(fields: string[]): CrmUserRecord | null {
  const id = Number(fields[0])
  if (!Number.isInteger(id) || id <= 0)
    return null

  // Расширенный дамп (23+ полей): phone, office, position, prem9
  if (fields.length >= 23) {
    const info = fields[19] ?? ''
    const permissions = permissionsFromPremSlice(
      fields.slice(10, 18).map(v => Number(v) || 0),
    )
    const password = fields[3] ?? ''
    const passwordMasked = shouldMaskPassword(permissions)
    return {
      id,
      active: Number(fields[1]) === 1,
      login: fields[2] ?? '',
      password: passwordMasked ? '' : password,
      passwordMasked,
      name: fields[4] ?? '',
      email: fields[5] ?? '',
      phone: fields[6] ?? '',
      office: fields[7] ?? '',
      position: fields[8] || info,
      info,
      notes: fields[20] ?? '',
      schedulePermission: Number(fields[18] ?? 0) === 1,
      isDeputy: Number(fields[21] ?? 0) === 1,
      deputyId: Number(fields[22] ?? 0) || 0,
      permissions,
    }
  }

  // Классический дамп: 19 полей (u_prem, u_prem1…8, info, notes, is_zam, zam_id)
  if (fields.length < 19)
    return null

  const info = fields[15] ?? ''
  const permissions = permissionsFromPremSlice(
    fields.slice(7, 15).map(v => Number(v) || 0),
  )
  const password = fields[3] ?? ''
  const passwordMasked = shouldMaskPassword(permissions)

  return {
    id,
    active: Number(fields[1]) === 1,
    login: fields[2] ?? '',
    password: passwordMasked ? '' : password,
    passwordMasked,
    name: fields[4] ?? '',
    email: fields[5] ?? '',
    phone: '',
    office: '',
    position: info,
    info,
    notes: fields[16] ?? '',
    schedulePermission: false,
    isDeputy: Number(fields[17] ?? 0) === 1,
    deputyId: Number(fields[18] ?? 0) || 0,
    permissions,
  }
}

function parseSqlTupleFields(line: string): string[] {
  let inner = line.trim()
  if (inner.endsWith(','))
    inner = inner.slice(0, -1)
  if (inner.endsWith(');'))
    inner = inner.slice(0, -2)
  else if (inner.endsWith(')'))
    inner = inner.slice(0, -1)
  if (inner.startsWith('('))
    inner = inner.slice(1)

  const fields: string[] = []
  let i = 0
  while (i < inner.length) {
    const ch = inner[i]
    if (ch === '\'') {
      let j = i + 1
      let value = ''
      while (j < inner.length) {
        if (inner[j] === '\'' && inner[j + 1] === '\'') {
          value += '\''
          j += 2
        } else if (inner[j] === '\'') {
          j++
          break
        } else {
          value += inner[j]
          j++
        }
      }
      fields.push(value)
      i = j
    } else {
      let j = i
      while (j < inner.length && inner[j] !== ',')
        j++
      fields.push(inner.slice(i, j).trim())
      i = j + 1
    }
    while (i < inner.length && (inner[i] === ',' || inner[i] === ' '))
      i++
  }

  return fields
}
