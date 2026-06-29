<script setup lang="ts">
withDefaults(defineProps<{
  /**
   * `icon` — компактная иконка (доска, чип вложений).
   * `table` — бейдж с текстом в таблице.
   * `badge` — короткий бейдж в шапке слайдовера.
   */
  variant?: 'icon' | 'table' | 'badge'
}>(), {
  variant: 'icon',
})
</script>

<template>
  <UTooltip
    v-if="variant === 'icon'"
    text="Скрытые файлы — содержимое недоступно пользователям без доступа"
  >
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 p-0.5 text-primary ring ring-inset ring-primary/20 transition-colors hover:bg-primary/15"
      role="img"
      aria-label="Скрытые файлы"
      tabindex="0"
      @click.stop
    >
      <UIcon
        name="i-lucide-lock"
        class="size-3.5"
        aria-hidden="true"
      />
    </span>
  </UTooltip>
  <UBadge
    v-else-if="variant === 'table'"
    color="primary"
    variant="subtle"
    size="md"
    icon="i-lucide-lock"
    label="Скрытые файлы"
    class="w-fit shrink-0 self-center whitespace-nowrap"
    @click.stop
  />
  <UBadge
    v-else
    color="primary"
    variant="subtle"
    size="sm"
    icon="i-lucide-lock"
    label="Файлы скрыты"
    class="shrink-0"
  />
</template>
