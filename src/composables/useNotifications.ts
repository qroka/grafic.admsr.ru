import { onMounted, onScopeDispose, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications'
import type { AppNotification } from '../types/notifications'
import { useAuth } from './useAuth'

const POLL_MS = 15_000

export function useNotifications() {
  const { ready, fetchMe, user } = useAuth()

  const loading = ref(false)
  const items = ref<AppNotification[]>([])
  const unread = ref(0)
  const total = ref(0)
  const open = ref(false)

  async function load() {
    if (!ready.value)
      await fetchMe()
    if (!ready.value || !user.value)
      return

    loading.value = true
    try {
      const res = await fetchNotifications({ limit: 50 })
      if (res.success) {
        items.value = res.items
        unread.value = res.unread
        total.value = res.total
      }
    } finally {
      loading.value = false
    }
  }

  async function readOne(id: number) {
    await markNotificationRead(id)
    const item = items.value.find(n => n.id === id)
    if (item && !item.readAt) {
      item.readAt = new Date().toISOString()
      unread.value = Math.max(0, unread.value - 1)
    }
  }

  async function readAll() {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    for (const item of items.value) {
      if (!item.readAt)
        item.readAt = now
    }
    unread.value = 0
  }

  const { pause, resume } = useIntervalFn(() => {
    void load()
  }, POLL_MS)

  onMounted(() => {
    void load()
    resume()
  })

  onScopeDispose(() => {
    pause()
  })

  return {
    loading,
    items,
    unread,
    total,
    open,
    load,
    readOne,
    readAll,
  }
}
