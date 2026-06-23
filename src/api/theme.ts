import { apiFetch } from './client'
import type { UserThemePreferences, UserThemePreferencesInput } from '../constants/theme'

export async function fetchUserTheme(): Promise<UserThemePreferences | null> {
  try {
    const res = await apiFetch<{ success: boolean, theme?: UserThemePreferences }>('/api/user/theme')
    return res.theme ?? null
  } catch {
    return null
  }
}

export async function saveUserTheme(theme: UserThemePreferencesInput): Promise<UserThemePreferences | null> {
  try {
    const res = await apiFetch<{ success: boolean, theme?: UserThemePreferences }>('/api/user/theme', {
      method: 'PUT',
      body: JSON.stringify(theme),
    })
    return res.theme ?? null
  } catch {
    return null
  }
}
