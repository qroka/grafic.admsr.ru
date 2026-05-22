<script setup lang="ts">
import type { ScheduleAttachmentFile } from '../../types/schedule'
import ScheduleAttachmentList from './ScheduleAttachmentList.vue'

defineProps<{
  files: ScheduleAttachmentFile[]
  label: string
}>()
</script>

<template>
  <UPopover
    v-if="files.length"
    :content="{ align: 'end', collisionPadding: 12 }"
  >
    <UButton color="neutral" variant="outline" size="md" @click.stop>
      {{ label }}
      <UIcon name="i-lucide-chevron-down" class="size-4" />
    </UButton>

    <template #content>
      <div class="w-[min(100vw-2rem,20rem)] p-2">
        <ScheduleAttachmentList :files="files" />
      </div>
    </template>
  </UPopover>
</template>
