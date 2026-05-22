import { ref, watch } from 'vue'
import { fetchActivityLogs } from '../api/logs'
import type { ActivityLogEntry, ActivityLogLevel, ActivityLogScope } from '../types/logs'

const PAGE_SIZE = 100

export function useActivityLogs() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const items = ref<ActivityLogEntry[]>([])
  const total = ref(0)
  const offset = ref(0)

  const logScope = ref<ActivityLogScope>('business')
  const searchQuery = ref('')
  const levelFilter = ref<ActivityLogLevel | 'all'>('all')

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchActivityLogs({
        q: searchQuery.value || undefined,
        level: levelFilter.value === 'all' ? undefined : levelFilter.value,
        scope: logScope.value,
        limit: PAGE_SIZE,
        offset: offset.value,
      })
      if (!res.success) {
        throw new Error(res.error ?? 'Не удалось загрузить журнал')
      }
      items.value = res.items
      total.value = res.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Ошибка загрузки'
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    searchQuery.value = ''
    levelFilter.value = 'all'
    offset.value = 0
  }

  function nextPage() {
    if (offset.value + PAGE_SIZE < total.value) {
      offset.value += PAGE_SIZE
    }
  }

  function prevPage() {
    offset.value = Math.max(0, offset.value - PAGE_SIZE)
  }

  watch([searchQuery, levelFilter, logScope], () => {
    offset.value = 0
    void load()
  })

  watch(offset, () => {
    void load()
  })

  return {
    loading,
    error,
    items,
    total,
    offset,
    pageSize: PAGE_SIZE,
    logScope,
    searchQuery,
    levelFilter,
    load,
    resetFilters,
    nextPage,
    prevPage,
  }
}
