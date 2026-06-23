import { getDb } from '../db/sqlite.js'
import type { UserThemePreferences, UserThemePreferencesInput } from '../types/theme.js'

interface ThemeRow {
  theme_primary: string | null
  theme_neutral: string | null
  theme_color_mode: string | null
}

export function getUserThemePreferences(userId: number): UserThemePreferences {
  const row = getDb()
    .prepare(
      `SELECT theme_primary, theme_neutral, theme_color_mode
       FROM users WHERE id = ?`,
    )
    .get(userId) as ThemeRow | undefined

  if (!row) {
    return { primary: null, neutral: null, colorMode: null }
  }

  return {
    primary: row.theme_primary as UserThemePreferences['primary'],
    neutral: row.theme_neutral as UserThemePreferences['neutral'],
    colorMode: row.theme_color_mode as UserThemePreferences['colorMode'],
  }
}

export function updateUserThemePreferences(
  userId: number,
  input: UserThemePreferencesInput,
): UserThemePreferences {
  getDb()
    .prepare(
      `UPDATE users
       SET theme_primary = ?, theme_neutral = ?, theme_color_mode = ?
       WHERE id = ?`,
    )
    .run(input.primary, input.neutral, input.colorMode, userId)

  return {
    primary: input.primary,
    neutral: input.neutral,
    colorMode: input.colorMode,
  }
}
