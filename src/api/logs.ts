import { apiFetch } from './client'
import type {
  ActivityLogCategory,
  ActivityLogEntry,
  ActivityLogLevel,
  ActivityLogScope,
} from '../types/logs'

export interface FetchActivityLogsParams {
  q?: string
  level?: ActivityLogLevel
  category?: ActivityLogCategory
  scope?: ActivityLogScope
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface ActivityLogsResponse {
  success: boolean
  total: number
  items: ActivityLogEntry[]
  error?: string
}

export async function fetchActivityLogs(
  params: FetchActivityLogsParams = {},
): Promise<ActivityLogsResponse> {
  const search = new URLSearchParams()
  if (params.q?.trim())
    search.set('q', params.q.trim())
  if (params.level)
    search.set('level', params.level)
  if (params.category)
    search.set('category', params.category)
  if (params.scope)
    search.set('scope', params.scope)
  if (params.from)
    search.set('from', params.from)
  if (params.to)
    search.set('to', params.to)
  if (params.limit != null)
    search.set('limit', String(params.limit))
  if (params.offset != null)
    search.set('offset', String(params.offset))

  const query = search.toString()
  return apiFetch<ActivityLogsResponse>(`/api/logs${query ? `?${query}` : ''}`)
}
