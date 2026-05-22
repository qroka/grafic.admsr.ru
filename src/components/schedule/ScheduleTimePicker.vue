<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { formFieldInjectionKey } from '@nuxt/ui/composables/useFormField'

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const formField = inject(formFieldInjectionKey, null)
const hasError = computed(() => Boolean(formField?.value?.error))

const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => {
  const value = String(i).padStart(2, '0')
  return { label: value, value }
})

const MINUTE_ITEMS = Array.from({ length: 12 }, (_, i) => {
  const value = String(i * 5).padStart(2, '0')
  return { label: value, value }
})

function snapMinute(minute: number): string {
  const snapped = Math.min(55, Math.round(minute / 5) * 5)
  return String(snapped).padStart(2, '0')
}

function parseParts(value: string): { hour: string, minute: string } {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m)
    return { hour: '09', minute: '00' }
  const hour = Math.min(23, Math.max(0, Number(m[1])))
  const minute = Math.min(59, Math.max(0, Number(m[2])))
  return {
    hour: String(hour).padStart(2, '0'),
    minute: snapMinute(minute),
  }
}

const hour = ref('09')
const minute = ref('00')
const popoverOpen = ref(false)

watch(
  model,
  (value) => {
    const parts = parseParts(value || '09:00')
    hour.value = parts.hour
    minute.value = parts.minute
  },
  { immediate: true },
)

function syncModelFromParts() {
  const next = `${hour.value}:${minute.value}`
  if (model.value !== next)
    model.value = next
}

watch([hour, minute], syncModelFromParts)

const displayValue = computed(() => {
  const parts = parseParts(model.value || '')
  if (!model.value?.trim())
    return ''
  return `${parts.hour}:${parts.minute}`
})

const buttonLabel = computed(() => displayValue.value || props.placeholder || 'Выберите время')
</script>

<template>
  <div
    v-if="disabled"
    class="flex min-h-9 w-full items-center rounded-md border border-default bg-default px-3 py-2 text-sm text-muted"
  >
    {{ displayValue || '—' }}
  </div>

  <UPopover
    v-else
    v-model:open="popoverOpen"
    class="w-full"
  >
    <UButton
      :color="hasError ? 'error' : 'neutral'"
      variant="outline"
      class="w-full justify-between font-normal"
      :aria-label="displayValue ? `Время: ${displayValue}. Изменить` : 'Выбрать время'"
      :aria-invalid="hasError || undefined"
    >
      <span :class="displayValue ? 'text-default' : 'text-dimmed'">
        {{ buttonLabel }}
      </span>
      <UIcon name="i-lucide-clock" class="size-4 shrink-0 text-dimmed" />
    </UButton>

    <template #content>
      <div class="flex items-end gap-2 p-3">
        <UFormField label="Часы" class="w-20">
          <USelect
            v-model="hour"
            :items="HOUR_ITEMS"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <span class="pb-2 text-muted" aria-hidden="true">:</span>
        <UFormField label="Минуты" class="w-24">
          <USelect
            v-model="minute"
            :items="MINUTE_ITEMS"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
  </UPopover>
</template>
