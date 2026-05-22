import { getDb } from '../db/sqlite.js'

export interface ActivityLogRow {
  id: number
  createdAt: string
  level: string
  category: string
  action: string
  message: string
  userLogin: string | null
  userName: string | null
  entityType: string | null
  entityId: number | null
  ipAddress: string | null
  meta: Record<string, unknown> | null
}

export type ActivityLogScope = 'business' | 'system'

export const BUSINESS_LOG_CATEGORIES = ['auth', 'event', 'attachment'] as const
export const SYSTEM_LOG_CATEGORIES = ['system', 'participant'] as const

export interface ListActivityLogsQuery {
  q?: string
  level?: string
  category?: string
  scope?: ActivityLogScope
  from?: string
  to?: string
  limit?: number
  offset?: number
}

function sqliteToIso(createdAt: string): string {
  const trimmed = createdAt.trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed))
    return trimmed.endsWith('Z') ? trimmed : `${trimmed}Z`
  const normalized = trimmed.replace(' ', 'T')
  const parsed = new Date(`${normalized}Z`)
  if (Number.isNaN(parsed.getTime()))
    return trimmed
  return parsed.toISOString()
}

function parseMeta(json: string | null): Record<string, unknown> | null {
  if (!json)
    return null
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function mapRow(row: {
  id: number
  created_at: string
  level: string
  category: string
  action: string
  message: string
  user_login: string | null
  user_name: string | null
  entity_type: string | null
  entity_id: number | null
  ip_address: string | null
  meta_json: string | null
}): ActivityLogRow {
  return {
    id: row.id,
    createdAt: sqliteToIso(row.created_at),
    level: row.level,
    category: row.category,
    action: row.action,
    message: row.message,
    userLogin: row.user_login,
    userName: row.user_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ipAddress: row.ip_address,
    meta: parseMeta(row.meta_json),
  }
}

export function listActivityLogs(query: ListActivityLogsQuery): {
  total: number
  items: ActivityLogRow[]
} {
  const clauses: string[] = []
  const params: unknown[] = []

  if (query.level) {
    clauses.push('level = ?')
    params.push(query.level)
  }
  if (query.category) {
    clauses.push('category = ?')
    params.push(query.category)
  }
  if (query.scope === 'business') {
    clauses.push(`category IN (${BUSINESS_LOG_CATEGORIES.map(() => '?').join(', ')})`)
    params.push(...BUSINESS_LOG_CATEGORIES)
  } else if (query.scope === 'system') {
    clauses.push(`category IN (${SYSTEM_LOG_CATEGORIES.map(() => '?').join(', ')})`)
    params.push(...SYSTEM_LOG_CATEGORIES)
  }
  if (query.from) {
    clauses.push(`datetime(created_at) >= datetime(?)`)
    params.push(normalizeFilterDate(query.from, 'start'))
  }
  if (query.to) {
    clauses.push(`datetime(created_at) <= datetime(?)`)
    params.push(normalizeFilterDate(query.to, 'end'))
  }
  if (query.q?.trim()) {
    const term = `%${query.q.trim().toLowerCase()}%`
    clauses.push(`(
      lower(message) LIKE ? OR lower(action) LIKE ?
      OR lower(COALESCE(user_login, '')) LIKE ?
      OR lower(COALESCE(user_name, '')) LIKE ?
      OR lower(COALESCE(meta_json, '')) LIKE ?
    )`)
    params.push(term, term, term, term, term)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const db = getDb()

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM activity_logs ${where}`).get(...params) as {
      c: number
    }
  ).c

  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500)
  const offset = Math.max(query.offset ?? 0, 0)

  const rows = db
    .prepare(
      `SELECT id, created_at, level, category, action, message,
              user_login, user_name, entity_type, entity_id, ip_address, meta_json
       FROM activity_logs ${where}
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Parameters<typeof mapRow>[0][]

  return {
    total,
    items: rows.map(mapRow),
  }
}

function normalizeFilterDate(value: string, bound: 'start' | 'end'): string {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
    return bound === 'start' ? `${trimmed} 00:00:00` : `${trimmed} 23:59:59`
  return trimmed.replace('T', ' ').replace(/\.\d{3}Z?$/, '').slice(0, 19)
}
