<script setup lang="ts">
import { useNotifications } from '../../composables/useNotifications'
import type { AppNotification } from '../../types/notifications'
import NotificationEntry from './NotificationEntry.vue'

const emit = defineEmits<{
  openEvent: [eventId: number]
}>()

const {
  loading,
  items,
  unread,
  open,
  load,
  readOne,
  readAll,
} = useNotifications()

async function onOpen(notification: AppNotification) {
  if (!notification.readAt)
    await readOne(notification.id)

  if (notification.eventId != null) {
    open.value = false
    emit('openEvent', notification.eventId)
  }
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', collisionPadding: 12 }">
    <UButton
      color="neutral"
      variant="ghost"
      square
      aria-label="Уведомления"
      :loading="loading && !items.length"
    >
      <UChip
        :show="unread > 0"
        color="primary"
        size="sm"
        inset
      >
        <UIcon name="i-lucide-bell" class="size-5" />
      </UChip>
    </UButton>

    <template #content>
      <div class="flex w-[min(24rem,calc(100vw-2rem))] flex-col">
        <div class="flex items-center justify-between gap-3 border-b border-default px-3 py-2.5">
          <p class="text-sm font-semibold text-highlighted">
            Уведомления
          </p>
          <UButton
            v-if="unread > 0"
            label="Прочитать все"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="readAll()"
          />
        </div>

        <div v-if="loading && !items.length" class="px-3 py-8 text-center text-sm text-muted">
          Загружаем…
        </div>

        <div v-else-if="!items.length" class="px-3 py-8 text-center text-sm text-muted">
          Нет уведомлений
        </div>

        <div v-else class="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
          <NotificationEntry
            v-for="item in items"
            :key="item.id"
            :notification="item"
            @open="onOpen"
          />
        </div>

        <div class="border-t border-default px-3 py-2">
          <UButton
            label="Обновить"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            :loading="loading"
            @click="load()"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
