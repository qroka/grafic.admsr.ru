<script setup lang="ts">
import { computed, h, ref, resolveComponent, watch } from 'vue'
import type { TableColumn, TableRow } from '@nuxt/ui'
import {
  fetchCrmUsers,
  fetchCrmUsersMeta,
  type ApiCrmUser,
  type CrmUsersMetaResponse,
} from '../api/crm-users'
import { formatPermissionSummary } from '../constants/crm-user-fields'
import { useAuth } from '../composables/useAuth'
import CrmUserSlideover from '../components/customers/CrmUserSlideover.vue'

const t = {
  title: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 CRM',
  loadFail: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439',
  reqErr: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u043f\u0440\u043e\u0441\u0430',
  fio: '\u0424\u0418\u041e',
  login: '\u041b\u043e\u0433\u0438\u043d',
  pass: '\u041f\u0430\u0440\u043e\u043b\u044c',
  passMasked: '******',
  email: 'Email',
  rights: '\u041f\u0440\u0430\u0432\u0430',
  info: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435',
  active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
  yes: '\u0414\u0430',
  no: '\u041d\u0435\u0442',
  saved: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e',
  created: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441\u043e\u0437\u0434\u0430\u043d',
  saveErr: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f',
  saveFail: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  refresh: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
  add: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c',
  adminOnly: '\u0420\u0430\u0437\u0434\u0435\u043b \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430\u043c.',
  total: '\u0412\u0441\u0435\u0433\u043e:',
  activeN: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445:',
  searchPh: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0424\u0418\u041e, \u043b\u043e\u0433\u0438\u043d\u0443, email',
  notFound: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b',
}

const emptyCell = '-'

const { canViewLogs } = useAuth()
const toast = useToast()

const loading = ref(false)
const searchQuery = ref('')
const users = ref<ApiCrmUser[]>([])
const meta = ref<CrmUsersMetaResponse | null>(null)
const slideoverOpen = ref(false)
const slideoverMode = ref<'view' | 'create'>('view')
const selectedUser = ref<ApiCrmUser | null>(null)

const UBadge = resolveComponent('UBadge')

const levelLabel = (value: number) =>
  meta.value?.accessLevels.find(l => l.value === value)?.label ?? String(value)

function rightsPreview(user: ApiCrmUser): string {
  if (!meta.value)
    return emptyCell
  const lines = formatPermissionSummary(
    user.permissions,
    meta.value.permissionModules,
    levelLabel,
  )
  if (user.schedulePermission)
    lines.push(`${meta.value.scheduleModule.label}: ${t.yes}`)
  return lines.length ? lines.slice(0, 3).join('; ') + (lines.length > 3 ? '\u2026' : '') : emptyCell
}

async function loadMeta() {
  try {
    meta.value = await fetchCrmUsersMeta()
  } catch {
    meta.value = null
  }
}

async function loadUsers() {
  loading.value = true
  try {
    users.value = await fetchCrmUsers(searchQuery.value)
  } catch (e) {
    users.value = []
    toast.add({
      title: t.loadFail,
      description: e instanceof Error ? e.message : t.reqErr,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function initPage() {
  await loadMeta()
  await loadUsers()
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadUsers(), 300)
})

watch(canViewLogs, (allowed) => {
  if (allowed)
    void initPage()
}, { immediate: true })

const activeCount = computed(() => users.value.filter(u => u.active).length)

function openUserCard(user: ApiCrmUser) {
  selectedUser.value = user
  slideoverMode.value = 'view'
  slideoverOpen.value = true
}

function openCreate() {
  selectedUser.value = null
  slideoverMode.value = 'create'
  slideoverOpen.value = true
}

function onTableSelect(event: Event, row: TableRow<ApiCrmUser>) {
  const target = event.target as HTMLElement | undefined
  if (target?.closest('button, a, input, [role="checkbox"]'))
    return
  openUserCard(row.original)
}

function upsertUser(user: ApiCrmUser) {
  const idx = users.value.findIndex(u => u.id === user.id)
  if (idx >= 0)
    users.value[idx] = user
  else
    users.value = [user, ...users.value].sort((a, b) => {
      if (a.active !== b.active)
        return a.active ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })
  selectedUser.value = user
}

function onSlideoverSaved(user: ApiCrmUser) {
  upsertUser(user)
  toast.add({ title: t.saved, color: 'success' })
}

function onSlideoverCreated(user: ApiCrmUser) {
  upsertUser(user)
  slideoverMode.value = 'view'
  toast.add({ title: t.created, color: 'success' })
}

const columns: TableColumn<ApiCrmUser>[] = [
  {
    accessorKey: 'name',
    header: t.fio,
    cell: ({ row }) => {
      const u = row.original
      return h('div', { class: 'min-w-0' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, u.name),
        h('p', { class: 'text-xs text-muted truncate' }, u.login),
      ])
    },
  },
  {
    accessorKey: 'password',
    header: t.pass,
    cell: ({ row }) => {
      const u = row.original
      return h(
        'span',
        { class: 'font-mono text-sm text-muted' },
        u.passwordMasked ? t.passMasked : (u.password || emptyCell),
      )
    },
  },
  {
    accessorKey: 'email',
    header: t.email,
    cell: ({ row }) => h('span', { class: 'line-clamp-2 text-sm text-muted' }, row.original.email || emptyCell),
  },
  {
    id: 'rights',
    header: t.rights,
    cell: ({ row }) => h('span', { class: 'line-clamp-3 text-xs text-muted' }, rightsPreview(row.original)),
  },
  {
    accessorKey: 'info',
    header: t.info,
    cell: ({ row }) => h('span', { class: 'line-clamp-2 text-sm' }, row.original.info || emptyCell),
  },
  {
    accessorKey: 'active',
    header: t.active,
    cell: ({ row }) => row.original.active
      ? h(UBadge, { color: 'success', variant: 'subtle', label: t.yes })
      : h(UBadge, { color: 'neutral', variant: 'subtle', label: t.no }),
  },
]
</script>

<template>
  <UDashboardPanel id="crm-users">
    <template #header>
      <UDashboardNavbar :title="t.title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            :label="t.add"
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            @click="openCreate"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="loading"
            :aria-label="t.refresh"
            @click="initPage"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!canViewLogs" class="p-6 text-sm text-muted">
        {{ t.adminOnly }}
      </div>

      <template v-else>
        <UContainer class="flex flex-col gap-4 py-4">
          <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>{{ t.total }} <strong class="text-default">{{ users.length }}</strong></span>
            <span>{{ t.activeN }} <strong class="text-default">{{ activeCount }}</strong></span>
          </div>

          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            :placeholder="t.searchPh"
            size="lg"
            class="w-full max-w-xl"
          />

          <UTable
            :data="users"
            :columns="columns"
            :loading="loading"
            class="shrink-0 cursor-pointer"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0 min-w-[900px]',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40',
              th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default align-top',
            }"
            @select="onTableSelect"
          />

          <p v-if="!loading && !users.length" class="text-center text-sm text-muted py-8">
            {{ t.notFound }}
          </p>
        </UContainer>

        <CrmUserSlideover
          v-model:open="slideoverOpen"
          :user="selectedUser"
          :meta="meta"
          :mode="slideoverMode"
          @saved="onSlideoverSaved"
          @created="onSlideoverCreated"
        />
      </template>
    </template>
  </UDashboardPanel>
</template>
