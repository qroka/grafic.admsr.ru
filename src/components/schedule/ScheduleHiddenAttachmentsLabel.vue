<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
})
</script>

<template>
  <UAlert
    color="neutral"
    variant="subtle"
    icon="i-lucide-lock"
    :title="size === 'sm' ? 'Скрытые файлы' : 'Файлы скрыты'"
    description="Вам доступно только количество вложений. Скачать файлы могут участники и редакторы графика."
    :ui="{
      root: size === 'sm' ? 'items-start gap-2 p-2.5' : undefined,
      icon: size === 'sm' ? 'size-4 mt-0.5' : undefined,
      title: size === 'sm' ? 'text-xs font-medium' : 'text-sm font-medium',
      description: size === 'sm' ? 'text-xs leading-snug' : 'text-sm',
      wrapper: size === 'sm' ? 'items-start' : undefined,
    }"
  />
</template>
