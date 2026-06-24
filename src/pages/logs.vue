<route lang="yaml">
meta:
  requiresAdmin: true
</route>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { TabsItem } from '@nuxt/ui'
import { fetchEventById } from '../api/events'
import { buildScheduleEventSelection } from '../api/schedule-mapper'
import ActivityLogEntryCard from '../components/logs/ActivityLogEntryCard.vue'
import ScheduleEventSlideover from '../components/schedule/ScheduleEventSlideover.vue'
import { useActivityLogs } from '../composables/useActivityLogs'
import { useParticipants } from '../composables/useParticipants'
import { usePermissions } from '../composables/usePermissions'
import type { ActivityLogEntry, ActivityLogLevel } from '../types/logs'
import type {
  ScheduleAttachmentFile,
  ScheduleDateBlock,
  ScheduleRow,
  ScheduleUserGroup,
} from '../types/schedule'
import { activityLogScopeLabel, resolveLogActorParticipant } from '../utils/logs'
import { createScheduleDateBlocks } from '../utils/schedule'

const toast = useToast()
const { canEditSubstituteSlug } = usePermissions()
const { participants, load: loadParticipants } = useParticipants()

const {
  loading,
  error,
  items,
  total,
  offset,
  pageSize,
  logScope,
  searchQuery,
  levelFilter,
  load,
  resetFilters,
  nextPage,
  prevPage,
} = useActivityLogs()

const eventDetailOpen = ref(false)
const eventLoading = ref(false)
const eventSelection = ref<{
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
  initialAttachments: ScheduleAttachmentFile[]
} | null>(null)

const createDayBlocks = computed(() => createScheduleDateBlocks())

const scopeTabs = computed<TabsItem[]>(() => [
  { label: activityLogScopeLabel('business'), value: 'business', icon: 'i-lucide-briefcase' },
  { label: activityLogScopeLabel('system'), value: 'system', icon: 'i-lucide-server' },
])

const levelOptions = [
  { label: 'Все уровни', value: 'all' },
  { label: 'Инфо', value: 'info' },
  { label: 'Успех', value: 'success' },
  { label: 'Предупреждение', value: 'warning' },
  { label: 'Ошибка', value: 'error' },
] as const

const currentPage = computed(() => Math.floor(offset.value / pageSize) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const pageRangeLabel = computed(() => {
  if (!total.value)
    return '0 записей'
  const from = offset.value + 1
  const to = Math.min(offset.value + pageSize, total.value)
  return `${from}–${to} из ${total.value}`
})

const hasActiveFilters = computed(() =>
  searchQuery.value.trim().length > 0 || levelFilter.value !== 'all',
)

function actorParticipantFor(entry: ActivityLogEntry) {
  return resolveLogActorParticipant(entry, participants.value)
}

function canEditGroup(group: ScheduleUserGroup): boolean {
  return canEditSubstituteSlug(group.substituteKey)
}

async function openEventFromLog(eventId: number) {
  if (eventLoading.value)
    return

  eventLoading.value = true
  try {
    const event = await fetchEventById(eventId)
    const selection = buildScheduleEventSelection(event)
    if (!selection) {
      throw new Error('Не удалось открыть мероприятие')
    }

    eventSelection.value = {
      ...selection,
      initialAttachments: selection.row.attachmentFiles.map(f => ({ ...f })),
    }
    eventDetailOpen.value = true
  } catch (e) {
    toast.add({
      title: 'Не удалось открыть мероприятие',
      description: e instanceof Error ? e.message : 'Попробуйте позже',
      color: 'error',
    })
  } finally {
    eventLoading.value = false
  }
}

function onLevelChange(value: unknown) {
  levelFilter.value = (value ?? 'all') as ActivityLogLevel | 'all'
}

onMounted(() => {
  void loadParticipants()
})

watch(eventDetailOpen, (isOpen) => {
  if (!isOpen)
    eventSelection.value = null
})
</script>

<template>
  <UDashboardPanel
    id="activity-logs"
    :ui="{
      root: 'flex min-h-0 min-w-0 flex-1 flex-col',
      body: 'flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-6 pt-6 sm:pt-6 pb-0 sm:pb-0',
    }"
  >
    <template #header>
      <UDashboardNavbar title="Журнал событий" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UTabs
            v-model="logScope"
            :items="scopeTabs"
            :content="false"
            size="lg"
            color="neutral"
            class="w-full max-w-[calc(100vw-12rem)] sm:max-w-md"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            aria-label="Обновить журнал"
            :loading="loading"
            @click="load()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Поиск по сообщению, пользователю, IP…"
            size="lg"
            class="min-w-0 flex-1"
          />

          <USelect
            :model-value="levelFilter"
            :items="[...levelOptions]"
            value-key="value"
            label-key="label"
            size="lg"
            class="w-full sm:w-56"
            @update:model-value="onLevelChange"
          />

          <UButton
            v-if="hasActiveFilters"
            label="Сбросить"
            icon="i-lucide-filter-x"
            color="neutral"
            variant="outline"
            size="lg"
            @click="resetFilters()"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Не удалось загрузить журнал"
          :description="error"
        />

        <div
          v-if="loading && !items.length"
          class="flex flex-1 items-center justify-center py-16"
        >
          <div class="flex flex-col items-center gap-3">
            <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
            <p class="text-sm text-muted">
              Загружаем записи…
            </p>
          </div>
        </div>

        <UEmpty
          v-else-if="!loading && !items.length"
          class="flex-1 py-12"
          icon="i-lucide-scroll-text"
          title="Записей пока нет"
          :description="hasActiveFilters
            ? 'По выбранным фильтрам ничего не найдено.'
            : 'События появятся после действий пользователей в системе.'"
        />

        <div
          v-else
          class="min-h-0 min-w-0 flex-1 overflow-y-auto p-px pb-2"
        >
          <div class="space-y-3">
            <ActivityLogEntryCard
              v-for="entry in items"
              :key="entry.id"
              :entry="entry"
              :actor-participant="actorParticipantFor(entry)"
              @open-event="openEventFromLog"
            />
          </div>
        </div>

        <div
          v-if="total > pageSize"
          class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default py-4"
        >
          <p class="text-sm text-muted tabular-nums">
            {{ pageRangeLabel }}
          </p>
          <div class="flex items-center gap-2">
            <UButton
              label="Назад"
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="offset === 0 || loading"
              @click="prevPage()"
            />
            <span class="min-w-18 text-center text-sm text-muted tabular-nums">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <UButton
              label="Далее"
              trailing-icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="offset + pageSize >= total || loading"
              @click="nextPage()"
            />
          </div>
        </div>
      </div>

      <ScheduleEventSlideover
        v-model:open="eventDetailOpen"
        :selection="eventSelection"
        :editable="false"
        :is-create="false"
        :create-day-blocks="createDayBlocks"
        :available-participants="participants"
        :can-edit="eventSelection ? canEditGroup(eventSelection.group) : false"
      />
    </template>
  </UDashboardPanel>
</template>
