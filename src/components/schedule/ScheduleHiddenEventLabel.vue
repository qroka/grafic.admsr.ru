<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
})
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-eye-off"
    :title="size === 'sm' ? 'Скрытое мероприятие' : 'Мероприятие скрыто'"
    description="Вам доступны только дата и время. Подробности видят участники и редакторы графика."
    :ui="{
      title: size === 'sm' ? 'text-xs font-medium' : 'text-sm font-medium',
      description: size === 'sm' ? 'text-xs' : 'text-sm',
      wrapper: size === 'sm' ? 'items-center' : undefined,
    }"
  />
</template>
