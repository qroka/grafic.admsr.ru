<script setup lang="ts">
import type { ScheduleParticipant } from '../../types/schedule'

defineProps<{
  participant: ScheduleParticipant
  /** `header` — шапка слайдовера; `field` — форма; `table` — ячейка графика. */
  variant?: 'header' | 'field' | 'table'
  /** Организатор в шапке (a11y). */
  isCreator?: boolean
  /** Без карточки и клика (режим только просмотра). */
  disabled?: boolean
  /** Кнопка удаления справа на бейдже (форма). */
  removable?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <div
    v-if="disabled"
    :class="[
      'inline-flex cursor-not-allowed items-center text-default/85',
      variant === 'header'
        ? 'gap-1 rounded-md px-2 py-1 text-xs font-medium text-default'
        : variant === 'table'
          ? 'gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-default'
          : 'gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-default'
    ]"
    aria-disabled="true"
  >
    <UAvatar
      v-if="variant === 'table'"
      :src="participant.avatarSrc"
      size="xs"
      class="shrink-0"
    />
    <UAvatar
      v-else
      :src="participant.avatarSrc"
      class="size-4 shrink-0"
    />
    <span>{{ participant.name }}</span>
  </div>
  <div
    v-else-if="removable && variant === 'field'"
    class="inline-flex max-w-full items-stretch overflow-hidden rounded-md ring ring-inset ring-accented bg-elevated"
  >
    <UPopover
      mode="click"
      :content="{ side: 'bottom', sideOffset: 8, collisionPadding: 12 }"
    >
      <UButton
        color="neutral"
        variant="soft"
        size="xs"
        class="min-w-0 gap-1.5 rounded-none rounded-s-md px-2.5 py-1.5 pe-1.5"
        @click.stop
      >
        <UAvatar :src="participant.avatarSrc" class="size-4 shrink-0" />
        <span class="truncate text-xs font-medium">{{ participant.name }}</span>
      </UButton>
      <template #content>
        <div class="flex w-60 flex-col gap-2 rounded-md border border-default bg-default p-2">
          <div class="flex justify-center">
            <UAvatar :src="participant.avatarSrc" class="size-[86px]" />
          </div>
          <div class="text-center text-base font-medium text-default">
            <p>{{ participant.card.line1 }}</p>
            <p>{{ participant.card.line2 }}</p>
          </div>
          <div class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-mail" class="size-5 shrink-0" />
            {{ participant.card.email }}
          </div>
          <div class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-phone" class="size-5 shrink-0" />
            {{ participant.card.phone }}
          </div>
          <div class="flex items-center gap-1.5 text-sm text-muted">
            <UIcon name="i-lucide-map-pin" class="size-5 shrink-0" />
            {{ participant.card.address }}
          </div>
        </div>
      </template>
    </UPopover>
    <UButton
      color="neutral"
      variant="soft"
      size="xs"
      square
      icon="i-lucide-x"
      class="shrink-0 rounded-none rounded-e-md border-s border-default"
      aria-label="Удалить участника"
      @click.stop="emit('remove')"
    />
  </div>
  <UPopover
    v-else
    mode="click"
    :content="{ side: 'bottom', sideOffset: 8, collisionPadding: 12 }"
  >
    <UButton
      color="neutral"
      :variant="variant === 'table' ? 'ghost' : 'soft'"
      size="xs"
      :aria-label="isCreator ? 'Организатор мероприятия. Открыть карточку контакта' : undefined"
      :class="variant === 'header'
        ? 'gap-1 rounded-md px-2 py-1 text-xs font-medium text-default'
        : 'gap-1.5 rounded-md px-2.5 py-1.5'"
      @click.stop
    >
      <UAvatar
        v-if="variant === 'table'"
        :src="participant.avatarSrc"
        size="xs"
        class="shrink-0"
      />
      <UAvatar
        v-else
        :src="participant.avatarSrc"
        class="size-4 shrink-0"
      />
      <span
        :class="variant === 'header'
          ? ''
          : variant === 'table'
            ? 'text-sm font-medium'
            : 'text-xs font-medium'"
      >{{ participant.name }}</span>
    </UButton>
    <template #content>
      <div class="flex w-60 flex-col gap-2 rounded-md border border-default bg-default p-2">
        <div class="flex justify-center">
          <UAvatar :src="participant.avatarSrc" class="size-[86px]" />
        </div>
        <div class="text-center text-base font-medium text-default">
          <p>{{ participant.card.line1 }}</p>
          <p>{{ participant.card.line2 }}</p>
        </div>
        <div class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-mail" class="size-5 shrink-0" />
          {{ participant.card.email }}
        </div>
        <div class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-phone" class="size-5 shrink-0" />
          {{ participant.card.phone }}
        </div>
        <div class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-map-pin" class="size-5 shrink-0" />
          {{ participant.card.address }}
        </div>
      </div>
    </template>
  </UPopover>
</template>
