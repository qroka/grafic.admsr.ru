<script setup lang="ts">
import { computed } from 'vue'
import { schedulePlacePresets } from '../../config/schedule'
import type { SchedulePlaceQuickOption } from '../../utils/schedule'

const place = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled?: boolean
  quickOptions?: SchedulePlaceQuickOption[]
}>()

const options = computed(() => {
  if (props.quickOptions?.length)
    return props.quickOptions

  return schedulePlacePresets.map(preset => ({
    key: preset.value,
    label: preset.label,
    icon: preset.icon,
    fromPreset: true,
  }))
})

const hasUsageStats = computed(() =>
  options.value.some(option => (option.count ?? 0) > 0),
)

function selectPreset(label: string) {
  place.value = label
}

function isPresetActive(label: string): boolean {
  return (place.value ?? '').trim() === label
}

function optionTitle(option: SchedulePlaceQuickOption): string | undefined {
  if (!option.count)
    return undefined
  const suffix = option.count === 1 ? 'ие' : 'ия'
  return `${option.count} мероприят${suffix}`
}
</script>

<template>
  <p
    v-if="disabled"
    class="min-h-10 rounded-md border border-default px-3 py-2 text-sm text-default"
  >
    {{ place?.trim() || '—' }}
  </p>

  <div v-else class="flex w-full flex-col gap-2.5">
    <UInput
      v-model="place"
      variant="outline"
      icon="i-lucide-map-pin"
      placeholder="Место проведения"
      class="w-full"
    />

    <div v-if="options.length" class="flex flex-col gap-1.5">
      <p class="text-xs text-dimmed">
        Частые варианты
        <span v-if="hasUsageStats" class="text-muted">· по данным графика</span>
      </p>
      <div class="flex flex-wrap gap-1.5">
        <UButton
          v-for="option in options"
          :key="option.key"
          type="button"
          size="xs"
          :color="isPresetActive(option.label) ? 'primary' : 'neutral'"
          :variant="isPresetActive(option.label) ? 'soft' : 'outline'"
          :icon="option.icon"
          :title="optionTitle(option)"
          class="max-w-full whitespace-normal text-left"
          @click="selectPreset(option.label)"
        >
          <span>{{ option.label }}</span>
          <span
            v-if="option.count"
            class="ms-1 tabular-nums text-muted"
          >{{ option.count }}</span>
        </UButton>
      </div>
    </div>
  </div>
</template>
