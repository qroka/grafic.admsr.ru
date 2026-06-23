export const THEME_PRIMARY_COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

export const THEME_NEUTRAL_COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
] as const

export const THEME_COLOR_MODES = ['light', 'dark', 'auto'] as const

export type ThemePrimaryColor = typeof THEME_PRIMARY_COLORS[number]
export type ThemeNeutralColor = typeof THEME_NEUTRAL_COLORS[number]
export type ThemeColorMode = typeof THEME_COLOR_MODES[number]
