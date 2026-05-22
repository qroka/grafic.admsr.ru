import { computed } from 'vue'
import { useAuth } from './useAuth'
import type { ScheduleSubstituteSlug } from '../types/schedule'

export function usePermissions() {
  const { user } = useAuth()

  const isAdmin = computed(() => user.value?.role === 'admin')
  const isReadOnly = computed(() => user.value?.role === 'user')

  function canEditSubstituteSlug(slug: string): boolean {
    if (!user.value)
      return false
    return user.value.editableSubstituteSlugs.includes(slug)
  }

  function canEditSchedule(slug: ScheduleSubstituteSlug | null): boolean {
    return slug != null && canEditSubstituteSlug(slug)
  }

  return {
    user,
    isAdmin,
    isReadOnly,
    canEditSubstituteSlug,
    canEditSchedule,
  }
}
