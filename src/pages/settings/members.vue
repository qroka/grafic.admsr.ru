<script setup lang="ts">
const members: { name: string, username: string, role: string }[] = []
</script>

<template>
  <div>
    <UPageCard
      title="Участники"
      description="Список участников берётся из CRM при работе с графиком."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    />

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
      <p v-if="!members.length" class="p-6 text-sm text-muted">
        Отдельного списка участников здесь нет — они подгружаются с сервера CRM в форме мероприятия.
      </p>
    </UPageCard>
  </div>
</template>
