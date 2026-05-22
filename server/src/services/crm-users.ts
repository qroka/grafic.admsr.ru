import type { Env } from '../config/env.js'
import {
  CRM_ACCESS_LEVELS,
  CRM_ACTIVE_LEVELS,
  CRM_PERMISSION_MODULES,
  emptyCrmPermissions,
  permissionsFromRow,
  shouldMaskPassword,
} from '../constants/crm-user-fields.js'
import type {
  CreateCrmUserInput,
  CrmUserDeputyOption,
  CrmUserRecord,
  CrmUsersMeta,
  UpdateCrmUserInput,
} from '../types/crm-user.js'
import { loadCrmUsersFromSqlDump } from '../utils/parse-user-sql-dump.js'

type MysqlPool = import('mysql2/promise').Pool

let pool: MysqlPool | null = null

function useMysql(env: Env): boolean {
  return !env.CRM_MOCK && Boolean(env.CRM_DB_HOST && env.CRM_DB_USER && env.CRM_DB_NAME)
}

async function getPool(env: Env): Promise<MysqlPool> {
  if (pool)
    return pool
  const mysql = await import('mysql2/promise')
  pool = mysql.createPool({
    host: env.CRM_DB_HOST,
    port: env.CRM_DB_PORT,
    user: env.CRM_DB_USER,
    password: env.CRM_DB_PASSWORD,
    database: env.CRM_DB_NAME,
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4',
  })
  return pool
}

interface UserRow {
  u_id: number
  u_active: number
  u_login: string
  u_pass: string
  u_fio: string
  u_email: string
  u_phone: string | null
  u_office: string | null
  u_position: string | null
  u_prem1: number
  u_prem2: number
  u_prem3: number
  u_prem4: number
  u_prem5: number
  u_prem6: number
  u_prem7: number
  u_prem8: number
  u_prem9: number | null
  u_info: string
  u_notes: string | null
  u_is_zam: number
  u_zam_id: number
}

const SELECT_USERS = `
  SELECT u_id, u_active, u_login, u_pass, u_fio, u_email,
         COALESCE(u_phone, '') AS u_phone,
         COALESCE(u_office, '') AS u_office,
         COALESCE(NULLIF(u_position, ''), u_info, '') AS u_position,
         u_prem1, u_prem2, u_prem3, u_prem4, u_prem5, u_prem6, u_prem7, u_prem8,
         COALESCE(u_prem9, 0) AS u_prem9,
         u_info, COALESCE(u_notes, '') AS u_notes,
         u_is_zam, u_zam_id
  FROM user
`

function mapRow(row: UserRow, maskPassword = true): CrmUserRecord {
  const permissions = permissionsFromRow({
    u_prem1: row.u_prem1,
    u_prem2: row.u_prem2,
    u_prem3: row.u_prem3,
    u_prem4: row.u_prem4,
    u_prem5: row.u_prem5,
    u_prem6: row.u_prem6,
    u_prem7: row.u_prem7,
    u_prem8: row.u_prem8,
  })
  const info = row.u_info ?? ''
  const position = row.u_position?.trim() || info
  const passwordMasked = shouldMaskPassword(permissions)
  return {
    id: row.u_id,
    active: row.u_active === 1,
    login: row.u_login,
    password: maskPassword && passwordMasked ? '' : (row.u_pass ?? ''),
    passwordMasked,
    name: row.u_fio,
    email: row.u_email,
    phone: row.u_phone ?? '',
    office: row.u_office ?? '',
    position,
    info,
    notes: row.u_notes ?? '',
    schedulePermission: Number(row.u_prem9 ?? 0) === 1,
    isDeputy: row.u_is_zam === 1,
    deputyId: row.u_zam_id || 0,
    permissions,
  }
}

function applyInputToRecord(user: CrmUserRecord, input: UpdateCrmUserInput): void {
  if (input.active !== undefined)
    user.active = input.active
  if (input.login !== undefined)
    user.login = input.login
  if (input.password !== undefined)
    user.password = input.password
  if (input.name !== undefined)
    user.name = input.name
  if (input.email !== undefined)
    user.email = input.email
  if (input.phone !== undefined)
    user.phone = input.phone
  if (input.office !== undefined)
    user.office = input.office
  if (input.position !== undefined)
    user.position = input.position
  if (input.info !== undefined)
    user.info = input.info
  if (input.notes !== undefined)
    user.notes = input.notes
  if (input.schedulePermission !== undefined)
    user.schedulePermission = input.schedulePermission
  if (input.isDeputy !== undefined)
    user.isDeputy = input.isDeputy
  if (input.deputyId !== undefined)
    user.deputyId = input.deputyId
  if (input.permissions) {
    user.permissions = { ...user.permissions, ...input.permissions }
  }
  user.passwordMasked = shouldMaskPassword(user.permissions)
  if (user.passwordMasked)
    user.password = ''
}

function buildUpdateSets(input: UpdateCrmUserInput): { sets: string[], params: unknown[] } {
  const sets: string[] = []
  const params: unknown[] = []

  const scalar: [keyof UpdateCrmUserInput, string, (v: unknown) => unknown][] = [
    ['active', 'u_active', v => (v ? 1 : 0)],
    ['login', 'u_login', v => v],
    ['password', 'u_pass', v => v],
    ['name', 'u_fio', v => v],
    ['email', 'u_email', v => v],
    ['phone', 'u_phone', v => v],
    ['office', 'u_office', v => v],
    ['position', 'u_position', v => v],
    ['info', 'u_info', v => v],
    ['notes', 'u_notes', v => v],
    ['schedulePermission', 'u_prem9', v => (v ? 1 : 0)],
    ['isDeputy', 'u_is_zam', v => (v ? 1 : 0)],
    ['deputyId', 'u_zam_id', v => v],
  ]

  for (const [key, column, map] of scalar) {
    const value = input[key]
    if (value !== undefined) {
      sets.push(`${column} = ?`)
      params.push(map(value))
    }
  }

  if (input.permissions) {
    for (const mod of CRM_PERMISSION_MODULES) {
      const value = input.permissions[mod.key]
      if (value !== undefined) {
        sets.push(`${mod.column} = ?`)
        params.push(value)
      }
    }
  }

  return { sets, params }
}

export class CrmUsersService {
  constructor(private readonly env: Env) {}

  getMeta(): CrmUsersMeta {
    return {
      accessLevels: CRM_ACCESS_LEVELS.map(l => ({ value: l.value, label: l.label })),
      activeLevels: CRM_ACTIVE_LEVELS.map(l => ({ value: l.value, label: l.label })),
      permissionModules: CRM_PERMISSION_MODULES.map(m => ({ key: m.key, label: m.label })),
    }
  }

  async listDeputies(): Promise<CrmUserDeputyOption[]> {
    const users = await this.list()
    return users
      .filter(u => u.isDeputy)
      .map(u => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async list(search?: string): Promise<CrmUserRecord[]> {
    if (useMysql(this.env))
      return this.listFromMysql(search)

    let users = loadCrmUsersFromSqlDump()
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      users = users.filter(u => matchesSearch(u, q))
    }
    return users.map(u => ({
      ...u,
      password: u.passwordMasked ? '' : u.password,
    }))
  }

  async getById(id: number, includePassword = true): Promise<CrmUserRecord | null> {
    if (useMysql(this.env))
      return this.getByIdMysql(id, includePassword)

    const users = loadCrmUsersFromSqlDump()
    const user = users.find(u => u.id === id)
    if (!user)
      return null
    return {
      ...user,
      password: includePassword && !user.passwordMasked ? user.password : '',
    }
  }

  async create(input: CreateCrmUserInput): Promise<CrmUserRecord> {
    if (useMysql(this.env))
      return this.createMysql(input)

    return this.createMock(input)
  }

  async update(id: number, input: UpdateCrmUserInput): Promise<CrmUserRecord | null> {
    if (useMysql(this.env))
      return this.updateMysql(id, input)

    return this.updateMock(id, input)
  }

  private async listFromMysql(search?: string): Promise<CrmUserRecord[]> {
    const db = await getPool(this.env)
    let sql = `${SELECT_USERS} ORDER BY u_active DESC, u_fio ASC`
    const params: string[] = []

    if (search?.trim()) {
      const q = `%${search.trim()}%`
      sql = `${SELECT_USERS}
        WHERE u_fio LIKE ? OR u_login LIKE ? OR u_email LIKE ?
        ORDER BY u_active DESC, u_fio ASC`
      params.push(q, q, q)
    }

    const [rows] = await db.query(sql, params)
    return (rows as UserRow[]).map(row => mapRow(row, true))
  }

  private async getByIdMysql(id: number, includePassword: boolean): Promise<CrmUserRecord | null> {
    const db = await getPool(this.env)
    const [rows] = await db.query(`${SELECT_USERS} WHERE u_id = ? LIMIT 1`, [id])
    const row = (rows as UserRow[])[0]
    if (!row)
      return null
    return mapRow(row, !includePassword)
  }

  private async createMysql(input: CreateCrmUserInput): Promise<CrmUserRecord> {
    const permissions = { ...emptyCrmPermissions(), ...input.permissions }
    const db = await getPool(this.env)
    const [result] = await db.query(
      `INSERT INTO user (
        u_active, u_login, u_pass, u_fio, u_email,
        u_phone, u_office, u_position, u_prem,
        u_prem1, u_prem2, u_prem3, u_prem4, u_prem5, u_prem6, u_prem7, u_prem8,
        u_prem9, u_info, u_notes, u_is_zam, u_zam_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.active ? 1 : 0,
        input.login,
        input.password,
        input.name,
        input.email ?? '',
        input.phone ?? '',
        input.office ?? '',
        input.position ?? input.info ?? '',
        ...CRM_PERMISSION_MODULES.map(m => permissions[m.key]),
        input.schedulePermission ? 1 : 0,
        input.info ?? '',
        input.notes ?? '',
        input.isDeputy ? 1 : 0,
        input.deputyId ?? 0,
      ],
    )
    const header = result as { insertId?: number }
    const id = Number(header.insertId)
    const created = await this.getByIdMysql(id, true)
    if (!created)
      throw new Error('User created but not found')
    return created
  }

  private async updateMysql(
    id: number,
    input: UpdateCrmUserInput,
  ): Promise<CrmUserRecord | null> {
    const { sets, params } = buildUpdateSets(input)
    if (!sets.length)
      return this.getByIdMysql(id, true)

    params.push(id)
    const db = await getPool(this.env)
    const [result] = await db.query(
      `UPDATE user SET ${sets.join(', ')} WHERE u_id = ?`,
      params,
    )
    const header = result as { affectedRows?: number }
    if (!header.affectedRows)
      return null

    return this.getByIdMysql(id, true)
  }

  private createMock(input: CreateCrmUserInput): CrmUserRecord {
    const users = loadCrmUsersFromSqlDump()
    const maxId = users.reduce((m, u) => Math.max(m, u.id), 0)
    const permissions = { ...emptyCrmPermissions(), ...input.permissions }
    const user: CrmUserRecord = {
      id: maxId + 1,
      active: input.active,
      login: input.login,
      password: input.password,
      passwordMasked: shouldMaskPassword(permissions),
      name: input.name,
      email: input.email ?? '',
      phone: input.phone ?? '',
      office: input.office ?? '',
      position: input.position ?? input.info ?? '',
      info: input.info ?? '',
      notes: input.notes ?? '',
      schedulePermission: Boolean(input.schedulePermission),
      isDeputy: Boolean(input.isDeputy),
      deputyId: input.deputyId ?? 0,
      permissions,
    }
    if (user.passwordMasked)
      user.password = ''
    users.push(user)
    return { ...user }
  }

  private updateMock(id: number, input: UpdateCrmUserInput): CrmUserRecord | null {
    const users = loadCrmUsersFromSqlDump()
    const user = users.find(u => u.id === id)
    if (!user)
      return null

    applyInputToRecord(user, input)
    return { ...user }
  }
}

function matchesSearch(user: CrmUserRecord, q: string): boolean {
  const haystack = [
    user.name,
    user.login,
    user.email,
    user.phone,
    user.office,
    user.position,
    user.info,
    user.notes,
  ].join(' ').toLowerCase()
  return haystack.includes(q)
}
