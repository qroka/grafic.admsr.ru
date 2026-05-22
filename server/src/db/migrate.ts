import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import type { Env } from '../config/env.js'

const migrationsDir = resolveMigrationsDir()

function resolveMigrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../db/migrations')
}

export function runMigrations(database: Database.Database, env: Env): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map(row => (row as { version: string }).version),
  )

  // Только нумерованные миграции SQLite (001_*.sql). MySQL-дампы — в server/db/reference/.
  const files = readdirSync(migrationsDir)
    .filter(name => /^\d{3}_.+\.sql$/i.test(name))
    .sort()

  const apply = database.transaction((version: string, sql: string) => {
    database.exec(sql)
    database
      .prepare('INSERT INTO schema_migrations (version) VALUES (?)')
      .run(version)
  })

  for (const file of files) {
    const version = file.replace(/\.sql$/, '')
    if (applied.has(version))
      continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    apply(version, sql)
  }

  seedDefaultUser(database, env)
  seedRoleUsers(database)
}

function seedDefaultUser(database: Database.Database, env: Env): void {
  const count = database
    .prepare('SELECT COUNT(*) AS c FROM users')
    .get() as { c: number }

  if (count.c > 0)
    return

  const hash = bcrypt.hashSync(env.SEED_USER_PASSWORD, 10)
  database
    .prepare(
      `INSERT INTO users (login, password_hash, name, email, role)
       VALUES (?, ?, ?, ?, 'admin')`,
    )
    .run(env.SEED_USER_LOGIN, hash, 'Администратор CRM', 'admin@local')
}

/** Тестовые учётки для проверки ролей (только dev; логин = пароль). */
function seedRoleUsers(database: Database.Database): void {
  const findByLogin = database.prepare(
    `SELECT id FROM users WHERE login = ? COLLATE NOCASE`,
  )
  const insertUser = database.prepare(
    `INSERT INTO users (login, password_hash, name, email, role, substitute_slug)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const demoUsers = [
    {
      login: 'manager',
      password: 'manager',
      name: 'Руководитель (тест)',
      email: 'manager@local',
      role: 'manager',
      substituteSlug: 'markova',
    },
    {
      login: 'moderator',
      password: 'moderator',
      name: 'Модератор (тест)',
      email: 'moderator@local',
      role: 'moderator',
      substituteSlug: null,
    },
    {
      login: 'user',
      password: 'user',
      name: 'Пользователь (тест)',
      email: 'user@local',
      role: 'user',
      substituteSlug: null,
    },
  ] as const

  for (const u of demoUsers) {
    if (findByLogin.get(u.login))
      continue
    const hash = bcrypt.hashSync(u.password, 10)
    insertUser.run(
      u.login,
      hash,
      u.name,
      u.email,
      u.role,
      u.substituteSlug,
    )
  }

  const manager = findByLogin.get('manager') as { id: number } | undefined
  const moderator = findByLogin.get('moderator') as { id: number } | undefined
  if (!manager || !moderator)
    return

  database
    .prepare(
      `INSERT OR IGNORE INTO moderator_assignments (moderator_user_id, manager_user_id)
       VALUES (?, ?)`,
    )
    .run(moderator.id, manager.id)
}
