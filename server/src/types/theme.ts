import type { ThemeColorMode, ThemeNeutralColor, ThemePrimaryColor } from '../constants/theme-colors.js'

export interface UserThemePreferences {
  primary: ThemePrimaryColor | null
  neutral: ThemeNeutralColor | null
  colorMode: ThemeColorMode | null
}

export interface UserThemePreferencesInput {
  primary: ThemePrimaryColor
  neutral: ThemeNeutralColor
  colorMode: ThemeColorMode
}
