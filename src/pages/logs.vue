<route lang="yaml">
meta:
  requiresAdmin: true
</route>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead } from '@unhead/vue'
import type { TabsItem } from '@nuxt/ui'
import ActivityLogEntryCard from '../components/logs/ActivityLogEntryCard.vue'
import { useActivityLogs } from '../composables/useActivityLogs'
import type { ActivityLogLevel } from '../types/logs'
import { activityLogScopeLabel } from '../utils/logs'

useHead({ title: 'Журнал событий' })

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

function onLevelChange(value: unknown) {
  levelFilter.value = (value ?? 'all') as ActivityLogLevel | 'all'
}
</script>

<template>
  <UDashboardPanel
    id="activity-logs"
    :ui="{
      root: 'flex min-h-0 min-w-0 flex-1 flex-col',
      body: 'flex min-h-0 flex-1 flex-col overflow-hidden',
    }"
  >
    <template #header>
      <UDashboardNavbar title="Журнал событий">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
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
      <div class="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        <p class="text-sm text-muted">
          История входов, изменений мероприятий и системных действий. Доступно только администраторам.
        </p>

        <UTabs
          v-model="logScope"
          :items="scopeTabs"
          :content="false"
          color="neutral"
          class="w-full max-w-md"
        />

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
          class="flex flex-1 flex-col items-center justify-center gap-3 py-16"
        >
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
          <p class="text-sm text-muted">
            Загружаем записи…
          </p>
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
          class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-0.5"
        >
          <ActivityLogEntryCard
            v-for="entry in items"
            :key="entry.id"
            :entry="entry"
          />
        </div>

        <div
          v-if="total > pageSize"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4"
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
    </template>
  </UDashboardPanel>
</template>
