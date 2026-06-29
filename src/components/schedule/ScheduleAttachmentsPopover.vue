<script setup lang="ts">
import { computed } from 'vue'
import type { ScheduleAttachmentFile, ScheduleRow } from '../../types/schedule'
import {
  isScheduleRowAttachmentsHiddenForOthers,
  isScheduleRowAttachmentsRestricted,
} from '../../utils/schedule'
import ScheduleAttachmentList from './ScheduleAttachmentList.vue'
import ScheduleHiddenAttachmentsLabel from './ScheduleHiddenAttachmentsLabel.vue'
import ScheduleHiddenAttachmentsNotice from './ScheduleHiddenAttachmentsNotice.vue'

const props = withDefaults(defineProps<{
  files: ScheduleAttachmentFile[]
  label: string
  row?: ScheduleRow
  /** `table` — компактный чип в ячейке графика. */
  variant?: 'table' | 'default'
}>(), {
  variant: 'default',
})

const count = computed(() => props.files.length)
const attachmentsRestricted = computed(() =>
  props.row ? isScheduleRowAttachmentsRestricted(props.row) : false,
)
const attachmentsHiddenForOthers = computed(() =>
  props.row ? isScheduleRowAttachmentsHiddenForOthers(props.row) : false,
)
const triggerAriaLabel = computed(() => {
  if (attachmentsRestricted.value)
    return `${props.label}, содержимое скрыто`
  if (attachmentsHiddenForOthers.value)
    return `${props.label}, файлы скрыты от других пользователей`
  return props.label
})
const triggerIcon = computed(() => {
  if (attachmentsRestricted.value)
    return 'i-lucide-lock'
  if (attachmentsHiddenForOthers.value)
    return 'i-lucide-lock'
  return 'i-lucide-paperclip'
})
</script>

<template>
  <UPopover
    v-if="files.length"
    :content="{ align: 'end', side: 'bottom', sideOffset: 6, collisionPadding: 12 }"
  >
    <UButton
      v-if="variant === 'table'"
      color="neutral"
      variant="soft"
      size="xs"
      :aria-label="triggerAriaLabel"
      class="h-7 max-w-full gap-1 rounded-full px-2.5 font-medium tabular-nums whitespace-nowrap"
      :class="attachmentsHiddenForOthers ? 'ring-1 ring-inset ring-primary/25' : undefined"
      @click.stop
    >
      <UIcon
        :name="triggerIcon"
        class="size-3.5 shrink-0"
        :class="attachmentsRestricted
          ? 'text-dimmed'
          : attachmentsHiddenForOthers
            ? 'text-primary'
            : 'text-muted'"
        aria-hidden="true"
      />
      <span class="text-xs text-default">{{ count }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3 shrink-0 text-dimmed" aria-hidden="true" />
    </UButton>

    <UButton
      v-else
      color="neutral"
      variant="outline"
      size="sm"
      :aria-label="triggerAriaLabel"
      class="max-w-full gap-1.5 whitespace-nowrap"
      @click.stop
    >
      <UIcon
        :name="triggerIcon"
        class="size-3.5 shrink-0"
        :class="attachmentsHiddenForOthers ? 'text-primary' : 'text-muted'"
        aria-hidden="true"
      />
      <span class="truncate">{{ label }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
    </UButton>

    <template #content>
      <div class="w-[min(100vw-2rem,18rem)] overflow-hidden rounded-lg border border-default bg-default shadow-md">
        <div class="flex items-center gap-2 border-b border-default px-3 py-2">
          <UIcon
            :name="attachmentsHiddenForOthers || attachmentsRestricted ? 'i-lucide-lock' : 'i-lucide-paperclip'"
            class="size-3.5 shrink-0"
            :class="attachmentsHiddenForOthers ? 'text-primary' : 'text-muted'"
            aria-hidden="true"
          />
          <p class="min-w-0 flex-1 truncate text-xs font-medium text-highlighted">
            {{ label }}
          </p>
        </div>
        <div class="max-h-[min(16rem,50vh)] overflow-y-auto p-1">
          <div class="flex flex-col gap-1 p-1">
            <ScheduleHiddenAttachmentsLabel
              v-if="attachmentsRestricted"
              size="sm"
            />
            <ScheduleHiddenAttachmentsNotice
              v-else-if="attachmentsHiddenForOthers"
              size="sm"
            />
            <ScheduleAttachmentList
              :files="files"
              :row="row"
              :variant="variant === 'table' ? 'compact' : 'default'"
            />
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
