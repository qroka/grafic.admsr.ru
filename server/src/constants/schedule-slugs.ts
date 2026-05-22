export const SCHEDULE_SUBSTITUTE_SLUGS = [
  'marcenkovskiy',
  'markova',
  'sidorov',
  'zhuravskaya',
  'nigmatullin',
] as const

export type ScheduleSubstituteSlug = (typeof SCHEDULE_SUBSTITUTE_SLUGS)[number]

export function isScheduleSubstituteSlug(s: string): s is ScheduleSubstituteSlug {
  return (SCHEDULE_SUBSTITUTE_SLUGS as readonly string[]).includes(s)
}
