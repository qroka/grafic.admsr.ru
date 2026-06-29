import { figmaScheduleAssets } from './figma-mcp-assets'
import type {
  ScheduleAccent,
  ScheduleDateBlock,
  ScheduleSubstituteSlug,
  ScheduleTitleValue,
  ScheduleUserGroup,
} from '../types/schedule'
import { scheduleSubstituteSlugs } from '../types/schedule'

/** Ширина колонки «Приложения» в таблице — под бейдж «Скрытые файлы». */
export const scheduleAttachmentsColumnWidth = '160px'

/** Типовые форматы и места проведения совещаний. */
export const schedulePlacePresets = [
  { value: 'vks', label: 'ВКС', icon: 'i-lucide-monitor-play' as const },
  { value: 'skype', label: 'Режим видеосовещания (Skype)', icon: 'i-lucide-video' as const },
  { value: 'cab-223', label: 'каб. 223 (Маркова Ю.В.)', icon: 'i-lucide-door-open' as const },
  { value: 'cab-104', label: 'каб. 104 (Нигматуллин М.Э.)', icon: 'i-lucide-door-open' as const },
  { value: 'small-hall', label: 'Малый зал', icon: 'i-lucide-presentation' as const },
  { value: 'cab-219', label: 'каб. 219', icon: 'i-lucide-door-open' as const },
  { value: 'cab-203', label: 'каб. 203', icon: 'i-lucide-door-open' as const },
] as const

export function findSubstituteGroup(
  block: ScheduleDateBlock,
  slug: ScheduleSubstituteSlug,
): ScheduleUserGroup | undefined {
  return block.groups.find(g => g.substituteKey === slug)
}

export const scheduleTitleOptions = [
  {
    label: 'Общий график',
    icon: 'i-lucide-file-text' as const,
    value: 'general' as const,
  },
  {
    label: 'Марценковский Р.Ф.',
    avatar: { src: figmaScheduleAssets.avatarMarcenkovskiy },
    value: 'marcenkovskiy' as const,
  },
  {
    label: 'Маркова Ю.В.',
    avatar: { src: figmaScheduleAssets.avatarMarkova },
    value: 'markova' as const,
  },
  {
    label: 'Сидоров П.А.',
    avatar: { src: figmaScheduleAssets.avatarSidorov },
    value: 'sidorov' as const,
  },
  {
    label: 'Журавская О.Р.',
    avatar: { src: figmaScheduleAssets.avatarZhuravskaya },
    value: 'zhuravskaya' as const,
  },
  {
    label: 'Нигматуллин М.Э.',
    avatar: { src: figmaScheduleAssets.avatarNigmatullin },
    value: 'nigmatullin' as const,
  },
] as const

const substituteAccentBySlug: Record<ScheduleSubstituteSlug, ScheduleAccent> = {
  marcenkovskiy: 'violet',
  markova: 'rose',
  sidorov: 'blue',
  zhuravskaya: 'amber',
  nigmatullin: 'emerald',
}

export function isScheduleSubstituteSlug(s: string): s is ScheduleSubstituteSlug {
  return (scheduleSubstituteSlugs as readonly string[]).includes(s)
}

export function scheduleNavbarHeading(slug: ScheduleTitleValue): string {
  if (slug === 'general')
    return 'График заместителей общий'
  const bySlug: Record<ScheduleSubstituteSlug, string> = {
    marcenkovskiy: 'График Марценковского Р.Ф.',
    markova: 'График Марковой Ю.В.',
    sidorov: 'График Сидорова П.А.',
    zhuravskaya: 'График Журавской О.Р.',
    nigmatullin: 'График Нигматуллина М.Э.',
  }
  return bySlug[slug]
}

export function scheduleNavbarAvatar(
  slug: ScheduleTitleValue,
): { src: string } | undefined {
  if (slug === 'general')
    return undefined
  const opt = scheduleTitleOptions.find(o => o.value === slug)
  return opt && 'avatar' in opt ? opt.avatar : undefined
}

export function ensureSubstituteGroup(
  block: ScheduleDateBlock,
  slug: ScheduleSubstituteSlug,
): ScheduleUserGroup {
  const existing = findSubstituteGroup(block, slug)
  if (existing)
    return existing
  const opt = scheduleTitleOptions.find(o => o.value === slug)
  const group: ScheduleUserGroup = {
    name: opt?.label ?? slug,
    avatarSrc: opt && 'avatar' in opt ? opt.avatar.src : figmaScheduleAssets.avatar,
    accent: substituteAccentBySlug[slug],
    substituteKey: slug,
    rows: [],
  }
  block.groups.push(group)
  return group
}
