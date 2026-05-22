<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import {
  formatScheduleDateString,
  parseScheduleDateString
} from '../../utils/schedule'

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled?: boolean
  /** ДД.ММ.ГГГГ — только эти даты доступны в календаре (режим создания). */
  availableDates?: string[]
  minValue?: CalendarDate
  maxValue?: CalendarDate
}>()

const inputDate = useTemplateRef('inputDate')
const calendarValue = shallowRef<CalendarDate | undefined>(undefined)

const availableDateSet = computed(
  () => new Set(props.availableDates?.filter(Boolean) ?? [])
)

function syncCalendarFromModel(value: string) {
  const parsed = parseScheduleDateString(value)
  if (!parsed) {
    calendarValue.value = undefined
    return
  }
  if (!calendarValue.value || calendarValue.value.compare(parsed) !== 0)
    calendarValue.value = parsed
}

watch(model, syncCalendarFromModel, { immediate: true })

watch(calendarValue, (next) => {
  if (!next)
    return
  const formatted = formatScheduleDateString(next)
  if (model.value !== formatted)
    model.value = formatted
})

const isDateUnavailable = computed(() => {
  if (props.minValue && props.maxValue)
    return undefined
  if (!availableDateSet.value.size)
    return undefined
  return (date: DateValue) => !availableDateSet.value.has(formatScheduleDateString(date))
})

</script>

<template>
  <UInputDate
    ref="inputDate"
    v-model="calendarValue"
    variant="outline"
    class="w-full"
    :disabled="disabled"
    :readonly="disabled"
    :min-value="minValue"
    :max-value="maxValue"
    :is-date-unavailable="isDateUnavailable"
  >
    <template v-if="!disabled" #trailing>
      <UPopover :reference="inputDate?.inputsRef[3]?.$el">
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-calendar"
          aria-label="Выбрать дату"
          class="px-0"
        />

        <template #content>
          <UCalendar
            v-model="calendarValue"
            class="p-2"
            :min-value="minValue"
            :max-value="maxValue"
            :is-date-unavailable="isDateUnavailable"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
