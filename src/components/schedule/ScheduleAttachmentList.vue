<script setup lang="ts">
import {
  downloadScheduleAttachment,
  previewScheduleAttachment,
} from '../../utils/schedule'
import {
  downloadEventAttachment,
  previewEventAttachment,
} from '../../api/attachments'
import type { ScheduleAttachmentFile } from '../../types/schedule'

defineProps<{
  files: ScheduleAttachmentFile[]
}>()

async function preview(file: ScheduleAttachmentFile) {
  if (file.id)
    await previewEventAttachment(file.id)
  else
    previewScheduleAttachment(file)
}

async function download(file: ScheduleAttachmentFile) {
  if (file.id)
    await downloadEventAttachment(file.id, file.name)
  else
    downloadScheduleAttachment(file)
}
</script>

<template>
  <ul v-if="files.length" class="flex flex-col gap-2">
    <li
      v-for="(file, index) in files"
      :key="file.id ?? `${file.name}-${index}`"
      class="flex items-center gap-2 rounded-md border border-default px-2.5 py-2"
    >
      <div class="flex shrink-0 items-center rounded-full bg-elevated p-2">
        <UIcon name="i-lucide-file" class="size-4 text-muted" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-default">
          {{ file.name }}
        </p>
        <p class="text-xs text-muted">
          {{ file.size }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <UButton
          color="neutral"
          variant="ghost"
          square
          size="sm"
          icon="i-lucide-eye"
          aria-label="Просмотреть файл"
          @click="preview(file)"
        />
        <UButton
          color="neutral"
          variant="ghost"
          square
          size="sm"
          icon="i-lucide-download"
          aria-label="Скачать файл"
          @click="download(file)"
        />
      </div>
    </li>
  </ul>
  <p v-else class="text-sm text-muted">
    Файлов нет
  </p>
</template>
