<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActivityLogEntry } from '../../types/logs'
import {
  activityLogCategoryLabel,
  activityLogHasEventDetails,
  activityLogLevelLabel,
  formatActivityLogTimestamp,
  parseActivityLogMeta,
} from '../../utils/logs'

const props = defineProps<{
  entry: ActivityLogEntry
}>()

const expanded = ref(false)

const meta = computed(() => parseActivityLogMeta(props.entry.meta))

const levelColor = computed(() => {
  const map = {
    info: 'primary',
    success: 'success',
    warning: 'warning',
    error: 'error',
  } as const
  return map[props.entry.level]
})

const categoryIcon = computed(() => {
  const map = {
    auth: 'i-lucide-log-in',
    event: 'i-lucide-calendar-range',
    attachment: 'i-lucide-paperclip',
    participant: 'i-lucide-users',
    system: 'i-lucide-server',
  } as const
  return map[props.entry.category]
})

const actorLabel = computed(() => {
  if (props.entry.userName?.trim())
    return props.entry.userName.trim()
  if (props.entry.userLogin?.trim())
    return props.entry.userLogin.trim()
  return 'Система'
})

const hasDetails = computed(() => activityLogHasEventDetails(props.entry)
  || Boolean(meta.value?.files?.length)
  || props.entry.entityId != null)
</script>

<template>
  <UCard
    variant="subtle"
    class="shrink-0 overflow-hidden transition-colors hover:ring-primary/20"
  >
    <button
      type="button"
      class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      :aria-expanded="hasDetails ? expanded : undefined"
      @click="hasDetails ? (expanded = !expanded) : undefined"
    >
      <div
        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated ring ring-default"
      >
        <UIcon :name="categoryIcon" class="size-4 text-muted" />
      </div>

      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :color="levelColor"
            variant="subtle"
            size="sm"
            :label="activityLogLevelLabel(entry.level)"
          />
          <UBadge
            color="neutral"
            variant="outline"
            size="sm"
            :label="activityLogCategoryLabel(entry.category)"
          />
          <span class="text-xs text-dimmed tabular-nums">
            {{ formatActivityLogTimestamp(entry.createdAt) }}
          </span>
        </div>

        <p class="text-sm font-medium leading-snug text-highlighted">
          {{ entry.message }}
        </p>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-user" class="size-3.5 shrink-0" />
            {{ actorLabel }}
          </span>
          <span v-if="entry.ipAddress" class="inline-flex items-center gap-1 tabular-nums">
            <UIcon name="i-lucide-globe" class="size-3.5 shrink-0" />
            {{ entry.ipAddress }}
          </span>
          <span v-if="entry.entityId != null" class="inline-flex items-center gap-1">
            <UIcon name="i-lucide-hash" class="size-3.5 shrink-0" />
            {{ entry.entityType ?? 'запись' }} #{{ entry.entityId }}
          </span>
        </div>
      </div>

      <UIcon
        v-if="hasDetails"
        :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="mt-1 size-4 shrink-0 text-dimmed"
      />
    </button>

    <div
      v-if="expanded && hasDetails"
      class="border-t border-default bg-elevated/30 px-4 py-3"
    >
      <div v-if="meta?.fields?.length" class="mb-3 space-y-2">
        <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
          Данные
        </p>
        <dl class="grid gap-2 sm:grid-cols-2">
          <div
            v-for="field in meta.fields"
            :key="field.key"
            class="rounded-md border border-default bg-default px-3 py-2"
          >
            <dt class="text-xs text-dimmed">
              {{ field.label }}
            </dt>
            <dd class="mt-0.5 text-sm text-default">
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </div>

      <div v-if="meta?.changes?.length" class="mb-3 space-y-2">
        <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
          Изменения
        </p>
        <ul class="space-y-2">
          <li
            v-for="change in meta.changes"
            :key="change.key"
            class="rounded-md border border-default bg-default px-3 py-2 text-sm"
          >
            <p class="text-xs text-dimmed">
              {{ change.label }}
            </p>
            <p class="mt-1 text-muted line-through">
              {{ change.before || '—' }}
            </p>
            <p class="mt-0.5 font-medium text-default">
              {{ change.after || '—' }}
            </p>
          </li>
        </ul>
      </div>

      <div v-if="meta?.files?.length" class="space-y-2">
        <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
          Файлы
        </p>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="file in meta.files"
            :key="file"
          >
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              icon="i-lucide-file"
              :label="file"
            />
          </li>
        </ul>
      </div>
    </div>
  </UCard>
</template>
