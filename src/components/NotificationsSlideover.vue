<script setup lang="ts">
import { useDashboard } from '../composables/useDashboard'

const { isNotificationsSlideoverOpen } = useDashboard()
</script>

<template>
  <USlideover v-model:open="isNotificationsSlideoverOpen" title="Уведомления">
    <template #body>
      <p class="px-3 py-6 text-sm text-muted">
        Нет уведомлений.
      </p>
    </template>
  </USlideover>
</template>