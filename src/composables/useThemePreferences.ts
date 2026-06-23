import { watch } from 'vue'
import { useColorMode, useDebounceFn } from '@vueuse/core'
import { fetchUserTheme, saveUserTheme } from '../api/theme'
import {
  DEFAULT_THEME,
  type ThemeColorMode,
  type ThemeNeutralColor,
  type ThemePrimaryColor,
  type UserThemePreferences,
} from '../constants/theme'
import { getAuthToken } from '../api/client'
import { useAuth } from './useAuth'

let applyingTheme = false

function applyThemePreferences(theme: UserThemePreferences | null): void {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()

  appConfig.ui.colors.primary = theme?.primary ?? DEFAULT_THEME.primary
  appConfig.ui.colors.neutral = theme?.neutral ?? DEFAULT_THEME.neutral
  colorMode.value = theme?.colorMode ?? DEFAULT_THEME.colorMode
}

function currentThemeInput(): {
  primary: ThemePrimaryColor
  neutral: ThemeNeutralColor
  colorMode: ThemeColorMode
} {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  return {
    primary: appConfig.ui.colors.primary as ThemePrimaryColor,
    neutral: appConfig.ui.colors.neutral as ThemeNeutralColor,
    colorMode: colorMode.value as ThemeColorMode,
  }
}

/**
 * Загружает и сохраняет тему в SQLite (по локальному user.id), не в CRM.
 */
export function useThemePreferences() {
  const { user } = useAuth()
  const appConfig = useAppConfig()
  const colorMode = useColorMode()

  const debouncedSave = useDebounceFn(async () => {
    if (applyingTheme || !getAuthToken() || !user.value)
      return
    await saveUserTheme(currentThemeInput())
  }, 400)

  async function loadThemeFromServer(): Promise<void> {
    if (!getAuthToken())
      return
    applyingTheme = true
    try {
      applyThemePreferences(await fetchUserTheme())
    } finally {
      applyingTheme = false
    }
  }

  watch(user, async (next, prev) => {
    if (next) {
      if (!prev || next.id !== prev.id)
        await loadThemeFromServer()
      return
    }
    if (prev)
      applyThemePreferences(null)
  })

  watch(
    () => [
      appConfig.ui.colors.primary,
      appConfig.ui.colors.neutral,
      colorMode.value,
      user.value?.id,
    ] as const,
    () => {
      void debouncedSave()
    },
  )

  return {
    loadThemeFromServer,
    resetThemeToDefaults: () => applyThemePreferences(null),
  }
}
