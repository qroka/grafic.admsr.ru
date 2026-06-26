<script setup lang="ts">
import {
  downloadScheduleAttachment,
  previewScheduleAttachment,
  isScheduleAttachmentRedacted,
} from '../../utils/schedule'
import {
  downloadEventAttachment,
  previewEventAttachment,
} from '../../api/attachments'
import type { ScheduleAttachmentFile, ScheduleRow } from '../../types/schedule'

const props = withDefaults(defineProps<{
  files: ScheduleAttachmentFile[]
  row?: ScheduleRow
  /** `compact` — выпадающий список в таблице; `default` — карточки в слайдовере. */
  variant?: 'compact' | 'default'
}>(), {
  variant: 'default',
})

function isRedacted(file: ScheduleAttachmentFile): boolean {
  return isScheduleAttachmentRedacted(file, props.row)
}

async function preview(file: ScheduleAttachmentFile) {
  if (isRedacted(file))
    return
  if (file.id)
    await previewEventAttachment(file.id)
  else
    previewScheduleAttachment(file)
}

async function download(file: ScheduleAttachmentFile) {
  if (isRedacted(file))
    return
  if (file.id)
    await downloadEventAttachment(file.id, file.name)
  else
    downloadScheduleAttachment(file)
}
</script>

<template>
  <ul
    v-if="files.length"
    :class="variant === 'compact' ? 'flex flex-col gap-0.5' : 'flex flex-col gap-2'"
  >
    <li
      v-for="(file, index) in files"
      :key="file.id ?? `${file.name}-${index}`"
      :class="variant === 'compact'
        ? 'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated/70'
        : 'flex items-center gap-2 rounded-md border border-default bg-default px-2.5 py-2'"
    >
      <div
        :class="variant === 'compact'
          ? 'flex size-7 shrink-0 items-center justify-center rounded-md bg-elevated/80'
          : 'flex shrink-0 items-center rounded-full bg-elevated p-2'"
      >
        <UIcon
          :name="isRedacted(file) ? 'i-lucide-lock' : 'i-lucide-file'"
          :class="variant === 'compact' ? 'size-3.5' : 'size-4'"
          class="text-muted"
          aria-hidden="true"
        />
      </div>

      <div class="min-w-0 flex-1">
        <p
          :class="[
            variant === 'compact' ? 'truncate text-xs font-medium' : 'truncate text-sm font-medium',
            isRedacted(file) ? 'text-muted' : 'text-default',
          ]"
        >
          {{ isRedacted(file) ? 'Файл скрыт' : file.name }}
        </p>
        <p v-if="!isRedacted(file) && file.size" class="truncate text-[11px] text-dimmed">
          {{ file.size }}
        </p>
      </div>

      <div
        v-if="!isRedacted(file)"
        :class="variant === 'compact'
          ? 'flex shrink-0 items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100'
          : 'flex shrink-0 items-center gap-1'"
      >
        <UButton
          color="neutral"
          variant="ghost"
          square
          :size="variant === 'compact' ? 'xs' : 'sm'"
          icon="i-lucide-eye"
          aria-label="Просмотреть файл"
          @click="preview(file)"
        />
        <UButton
          color="neutral"
          variant="ghost"
          square
          :size="variant === 'compact' ? 'xs' : 'sm'"
          icon="i-lucide-download"
          aria-label="Скачать файл"
          @click="download(file)"
        />
      </div>
    </li>
  </ul>
  <UEmpty
    v-else
    size="sm"
    variant="naked"
    icon="i-lucide-paperclip"
    title="Файлов нет"
    description="К этому мероприятию пока не прикреплены документы"
    class="py-4"
  />
</template>
