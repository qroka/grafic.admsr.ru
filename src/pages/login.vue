<route lang="yaml">
meta:
  layout: blank
  public: true
</route>

<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '@unhead/vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

useHead({ title: 'Авторизация' })

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
    await router.replace('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось войти'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-default p-6">
    <UCard class="w-full max-w-md" :ui="{ body: 'p-6 sm:p-8' }">
      <template #header>
        <div class="flex flex-col gap-1">
          <h1 class="text-xl font-semibold text-highlighted">
            График заместителей
          </h1>
          <p class="text-sm text-muted">
            Войдите, чтобы открыть расписание
          </p>
        </div>
      </template>

      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="error"
        />

        <UFormField label="Логин" required>
          <UInput
            v-model="loginName"
            autocomplete="username"
            placeholder="Введите логин"
            icon="i-lucide-user"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Пароль" required>
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Введите пароль"
            icon="i-lucide-lock"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          label="Войти"
          color="primary"
          size="lg"
          block
          :loading="loading"
        />
      </form>
    </UCard>
  </div>
</template>
