import { getDb } from '../db/sqlite.js'

function purgeExpiredJwtRevocations(nowSec: number): void {
  getDb()
    .prepare('DELETE FROM jwt_revocations WHERE expires_at <= ?')
    .run(nowSec)
}

export function isJwtRevoked(jti: string): boolean {
  const nowSec = Math.floor(Date.now() / 1000)
  purgeExpiredJwtRevocations(nowSec)

  const row = getDb()
    .prepare('SELECT 1 AS ok FROM jwt_revocations WHERE token_jti = ?')
    .get(jti) as { ok: 1 } | undefined

  return Boolean(row)
}

export function revokeJwt(jti: string, expiresAtSec: number): void {
  const nowSec = Math.floor(Date.now() / 1000)
  purgeExpiredJwtRevocations(nowSec)

  getDb()
    .prepare('INSERT OR IGNORE INTO jwt_revocations (token_jti, expires_at) VALUES (?, ?)')
    .run(jti, expiresAtSec)
}

export function getUserAuthEpoch(userId: number): number {
  const row = getDb()
    .prepare('SELECT auth_epoch FROM users WHERE id = ?')
    .get(userId) as { auth_epoch: number } | undefined
  return row?.auth_epoch ?? 0
}

export function bumpUserAuthEpoch(userId: number): void {
  getDb()
    .prepare('UPDATE users SET auth_epoch = auth_epoch + 1 WHERE id = ?')
    .run(userId)
}
