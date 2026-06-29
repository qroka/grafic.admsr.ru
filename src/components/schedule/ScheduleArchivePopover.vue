<script setup lang="ts">
import { computed, ref } from 'vue'
import { getLocalTimeZone, today } from '@internationalized/date'
import ScheduleDatePicker from './ScheduleDatePicker.vue'
import {
  addDaysToScheduleDate,
  formatScheduleDateString,
} from '../../utils/schedule'

const archiveEnabled = defineModel<boolean>('archiveEnabled', { default: false })
const jumpStartDate = defineModel<string | null>('jumpStartDate', { default: null })

const pickerDate = ref('')

const todayDate = today(getLocalTimeZone())
const yesterdayDate = computed(() => todayDate.subtract({ days: 1 }))
const todayStr = computed(() => formatScheduleDateString(todayDate))
const maxPickerDate = computed(() => yesterdayDate.value)

const isActive = computed(() =>
  Boolean(archiveEnabled.value || jumpStartDate.value),
)

const statusLabel = computed(() => {
  if (jumpStartDate.value)
    return `С ${jumpStartDate.value}`
  if (archiveEnabled.value)
    return 'Все'
  return ''
})

function jumpToYesterday() {
  const yesterday = addDaysToScheduleDate(todayStr.value, -1)
  if (!yesterday)
    return
  jumpStartDate.value = yesterday
  archiveEnabled.value = false
  pickerDate.value = yesterday
}

function applyPickerDate() {
  if (!pickerDate.value)
    return
  jumpStartDate.value = pickerDate.value
  archiveEnabled.value = false
}

function toggleArchive() {
  jumpStartDate.value = null
  pickerDate.value = ''
  archiveEnabled.value = !archiveEnabled.value
}

function resetToToday() {
  jumpStartDate.value = null
  archiveEnabled.value = false
  pickerDate.value = ''
}
</script>

<template>
  <UPopover :content="{ align: 'end', side: 'bottom', sideOffset: 8, collisionPadding: 12 }">
    <UButton
      color="neutral"
      :variant="isActive ? 'soft' : 'outline'"
      size="lg"
      icon="i-lucide-archive"
      class="shrink-0"
      :class="isActive ? 'ring-1 ring-inset ring-primary/25' : undefined"
    >
      <span>Архив</span>
      <UBadge
        v-if="statusLabel"
        color="primary"
        variant="subtle"
        size="sm"
        :label="statusLabel"
        class="ms-1 tabular-nums"
      />
    </UButton>

    <template #content>
      <div class="w-[min(100vw-2rem,20rem)] space-y-4 p-4">
        <div>
          <p class="text-sm font-semibold text-highlighted">
            Архив графика
          </p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            Все прошлые мероприятия из базы или переход к нужной дате.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <UButton
            label="Вчера"
            icon="i-lucide-calendar-arrow-down"
            color="neutral"
            variant="outline"
            size="sm"
            block
            @click="jumpToYesterday"
          />
          <UButton
            :label="archiveEnabled ? 'Скрыть архив' : 'Все прошлые мероприятия'"
            icon="i-lucide-history"
            color="neutral"
            :variant="archiveEnabled ? 'soft' : 'outline'"
            size="sm"
            block
            @click="toggleArchive"
          />
        </div>

        <div class="space-y-2 border-t border-default pt-3">
          <p class="text-xs font-medium text-dimmed">
            Перейти к дате
          </p>
          <ScheduleDatePicker
            v-model="pickerDate"
            :max-value="maxPickerDate"
          />
          <UButton
            label="Показать с даты"
            icon="i-lucide-calendar-search"
            color="primary"
            variant="soft"
            size="sm"
            block
            :disabled="!pickerDate"
            @click="applyPickerDate"
          />
        </div>

        <UButton
          v-if="isActive"
          label="Вернуться к текущей неделе"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          size="sm"
          block
          @click="resetToToday"
        />
      </div>
    </template>
  </UPopover>
</template>
