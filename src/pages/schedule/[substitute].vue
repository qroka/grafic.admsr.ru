<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubstitutesScheduleView from '../../components/schedule/SubstitutesScheduleView.vue'
import { isScheduleSubstituteSlug } from '../../config/schedule'

const route = useRoute()
const router = useRouter()

watch(
  () => route.params['substitute'],
  (s) => {
    if (typeof s === 'string' && !isScheduleSubstituteSlug(s))
      void router.replace('/schedule')
  },
  { immediate: true }
)
</script>

<template>
  <SubstitutesScheduleView />
</template>
