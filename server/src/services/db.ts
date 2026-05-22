import { getDb } from '../db/sqlite.js'

export type DbStatus = 'connected' | 'error'

export interface DbHealth {
  status: DbStatus
  driver: 'sqlite'
  path: string
  message: string
  usersCount?: number
  eventsCount?: number
}

export function getDbHealth(sqlitePath: string): DbHealth {
  try {
    const db = getDb()
    const usersCount = (
      db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    ).c
    const eventsCount = (
      db.prepare('SELECT COUNT(*) AS c FROM events').get() as { c: number }
    ).c

    return {
      status: 'connected',
      driver: 'sqlite',
      path: sqlitePath,
      message: 'SQLite ready',
      usersCount,
      eventsCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    return {
      status: 'error',
      driver: 'sqlite',
      path: sqlitePath,
      message,
    }
  }
}
