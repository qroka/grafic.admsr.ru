<route lang="yaml">
meta:
  layout: blank
  public: true
</route>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login } = useAuth()

const loginName = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(loginName.value.trim(), password.value)
    await router.replace('/schedule')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось войти'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-default p-6">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-lg font-semibold text-highlighted">
          Вход в CRM
        </h1>
        <p class="mt-1 text-sm text-muted">
          Локальная учётная запись (SQLite)
        </p>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <UFormField label="Логин">
          <UInput
            v-model="loginName"
            autocomplete="username"
            placeholder="Логин"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Пароль">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>
        <p v-if="error" class="text-sm text-error">
          {{ error }}
        </p>
        <UButton
          type="submit"
          label="Войти"
          color="primary"
          block
          :loading="loading"
        />
      </form>
    </UCard>
  </div>
</template>
