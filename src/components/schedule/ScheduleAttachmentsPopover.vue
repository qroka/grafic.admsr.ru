<script setup lang="ts">
import { computed } from 'vue'
import type { ScheduleAttachmentFile, ScheduleRow } from '../../types/schedule'
import { isScheduleRowAttachmentsRestricted } from '../../utils/schedule'
import ScheduleAttachmentList from './ScheduleAttachmentList.vue'

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
const triggerAriaLabel = computed(() =>
  attachmentsRestricted.value
    ? `${props.label}, содержимое скрыто`
    : props.label,
)
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
      @click.stop
    >
      <UIcon
        :name="attachmentsRestricted ? 'i-lucide-lock' : 'i-lucide-paperclip'"
        class="size-3.5 shrink-0"
        :class="attachmentsRestricted ? 'text-dimmed' : 'text-muted'"
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
      <UIcon name="i-lucide-paperclip" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span class="truncate">{{ label }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
    </UButton>

    <template #content>
      <div class="w-[min(100vw-2rem,18rem)] overflow-hidden rounded-lg border border-default bg-default shadow-md">
        <div class="flex items-center gap-2 border-b border-default px-3 py-2">
          <UIcon name="i-lucide-paperclip" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <p class="min-w-0 flex-1 truncate text-xs font-medium text-highlighted">
            {{ label }}
          </p>
        </div>
        <div class="max-h-[min(16rem,50vh)] overflow-y-auto p-1">
          <ScheduleAttachmentList
            :files="files"
            :row="row"
            :variant="variant === 'table' ? 'compact' : 'default'"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
