import { loadEnv } from '../config/env.js'
import { initDatabase, getDb, closeDatabase } from '../db/sqlite.js'

const env = loadEnv()
initDatabase(env)

const rows = getDb()
  .prepare('SELECT login, role, substitute_slug FROM users ORDER BY login')
  .all()
console.log('users:', rows)

const assignments = getDb()
  .prepare(
    `SELECT m.moderator_user_id, m.manager_user_id, mod.login AS moderator, mgr.login AS manager
     FROM moderator_assignments m
     JOIN users mod ON mod.id = m.moderator_user_id
     JOIN users mgr ON mgr.id = m.manager_user_id`,
  )
  .all()
console.log('moderator_assignments:', assignments)

closeDatabase()
