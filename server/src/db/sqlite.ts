import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import type { Env } from '../config/env.js'
import { runMigrations } from './migrate.js'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db)
    throw new Error('Database is not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(env: Env): Database.Database {
  if (db)
    return db

  const dbPath = resolve(serverRoot, env.SQLITE_PATH)
  mkdirSync(dirname(dbPath), { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db, env)
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = null
}
