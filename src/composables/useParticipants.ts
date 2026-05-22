import { ref } from 'vue'
import { apiFetch } from '../api/client'
import { crmParticipantToSchedule } from '../api/schedule-mapper'
import type { ApiCrmParticipant } from '../api/types'
import type { ScheduleParticipant } from '../types/schedule'

export function useParticipants() {
  const loading = ref(false)
  const participants = ref<ScheduleParticipant[]>([])

  async function load(search?: string): Promise<ScheduleParticipant[]> {
    loading.value = true
    try {
      const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      const res = await apiFetch<{
        success: boolean
        participants: ApiCrmParticipant[]
      }>(`/api/participants${q}`)
      participants.value = res.participants.map(crmParticipantToSchedule)
      return participants.value
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    participants,
    load,
  }
}
