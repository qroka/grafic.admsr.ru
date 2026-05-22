import bcrypt from 'bcryptjs'
import { getDb } from '../db/sqlite.js'
import {
  SCHEDULE_SUBSTITUTE_SLUGS,
  type ScheduleSubstituteSlug,
} from '../constants/schedule-slugs.js'
import type { LocalUser, UserAccessProfile } from '../types/auth.js'

interface UserRow {
  id: number
  login: string
  password_hash: string
  name: string
  email: string | null
  role: LocalUser['role']
  external_user_id: number | null
  substitute_slug: string | null
}

function mapUser(row: Omit<UserRow, 'password_hash'>): LocalUser {
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    email: row.email,
    role: row.role,
    externalUserId: row.external_user_id,
    substituteSlug: row.substitute_slug,
  }
}

function listModeratedSubstituteSlugs(moderatorUserId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT u.substitute_slug AS slug
       FROM moderator_assignments m
       INNER JOIN users u ON u.id = m.manager_user_id
       WHERE m.moderator_user_id = ?
         AND u.substitute_slug IS NOT NULL`,
    )
    .all(moderatorUserId) as { slug: string }[]

  return rows
    .map(r => r.slug)
    .filter((slug): slug is ScheduleSubstituteSlug =>
      (SCHEDULE_SUBSTITUTE_SLUGS as readonly string[]).includes(slug),
    )
}

function editableSubstituteSlugsFor(user: LocalUser): string[] {
  if (user.role === 'admin')
    return [...SCHEDULE_SUBSTITUTE_SLUGS]
  if (user.role === 'manager' && user.substituteSlug)
    return [user.substituteSlug]
  if (user.role === 'moderator')
    return listModeratedSubstituteSlugs(user.id)
  return []
}

export async function verifyCredentials(
  login: string,
  password: string,
): Promise<LocalUser | null> {
  const row = getDb()
    .prepare(
      `SELECT id, login, password_hash, name, email, role,
              external_user_id, substitute_slug
       FROM users WHERE login = ? COLLATE NOCASE`,
    )
    .get(login) as UserRow | undefined

  if (!row)
    return null

  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid)
    return null

  return mapUser(row)
}

export function findUserById(id: number): LocalUser | null {
  const row = getDb()
    .prepare(
      `SELECT id, login, name, email, role, external_user_id, substitute_slug
       FROM users WHERE id = ?`,
    )
    .get(id) as Omit<UserRow, 'password_hash'> | undefined

  return row ? mapUser(row) : null
}

export function findUserAccessById(id: number): UserAccessProfile | null {
  const user = findUserById(id)
  if (!user)
    return null
  return {
    ...user,
    editableSubstituteSlugs: editableSubstituteSlugsFor(user),
  }
}

export function toPublicUserProfile(profile: UserAccessProfile) {
  return {
    id: profile.id,
    login: profile.login,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    externalUserId: profile.externalUserId,
    substituteSlug: profile.substituteSlug,
    editableSubstituteSlugs: profile.editableSubstituteSlugs,
  }
}
