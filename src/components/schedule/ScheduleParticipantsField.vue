<script setup lang="ts">
import { computed } from 'vue'
import type { ScheduleParticipant } from '../../types/schedule'
import { scheduleParticipantKey } from '../../utils/schedule'
import ScheduleParticipantPopoverChip from './ScheduleParticipantPopoverChip.vue'

const selectedParticipantKeys = defineModel<string[]>({ default: () => [] })

const props = defineProps<{
  availableParticipants: ScheduleParticipant[]
  disabled?: boolean
}>()

const participantsByKey = computed(() => {
  const map = new Map<string, ScheduleParticipant>()
  for (const participant of props.availableParticipants)
    map.set(scheduleParticipantKey(participant), participant)
  return map
})

const participantSelectItems = computed(() =>
  props.availableParticipants.map(participant => ({
    label: participant.name,
    value: scheduleParticipantKey(participant),
    avatar: { src: participant.avatarSrc, alt: participant.name },
  })),
)

const selectedParticipants = computed(() =>
  selectedParticipantKeys.value
    .map(key => participantsByKey.value.get(key))
    .filter((p): p is ScheduleParticipant => Boolean(p)),
)

function removeParticipant(participant: ScheduleParticipant) {
  const key = scheduleParticipantKey(participant)
  selectedParticipantKeys.value = selectedParticipantKeys.value.filter(k => k !== key)
}
</script>

<template>
  <div
    v-if="disabled"
    class="flex min-h-10 w-full flex-wrap gap-2 rounded-md border border-default px-3 py-2"
  >
    <ScheduleParticipantPopoverChip
      v-for="participant in selectedParticipants"
      :key="scheduleParticipantKey(participant)"
      variant="field"
      disabled
      :participant="participant"
    />
    <span v-if="!selectedParticipants.length" class="text-sm text-muted">
      Участников нет
    </span>
  </div>

  <USelectMenu
    v-else
    v-model="selectedParticipantKeys"
    :items="participantSelectItems"
    value-key="value"
    name="participants"
    multiple
    icon="i-lucide-users"
    placeholder="Выберите участников"
    size="lg"
    :search-input="{ placeholder: 'Найти участника…' }"
    class="w-full"
    :ui="{
      trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
      value: 'flex min-h-6 flex-1 flex-wrap items-center gap-1.5 py-0.5',
      base: 'min-h-10',
    }"
  >
    <template #default>
      <div
        v-if="selectedParticipants.length"
        class="flex flex-1 flex-wrap items-center gap-1.5"
        @click.stop
      >
        <ScheduleParticipantPopoverChip
          v-for="participant in selectedParticipants"
          :key="scheduleParticipantKey(participant)"
          variant="field"
          removable
          :participant="participant"
          @remove="removeParticipant(participant)"
        />
      </div>
      <span v-else class="text-dimmed">
        Выберите участников
      </span>
    </template>
  </USelectMenu>
</template>
