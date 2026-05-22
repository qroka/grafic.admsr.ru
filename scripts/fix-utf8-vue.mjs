import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const ru = {
  schedule: '\u0413\u0440\u0430\u0444\u0438\u043a \u0437\u0430\u043c\u0435\u0441\u0442\u0438\u0442\u0435\u043b\u0435\u0439',
  users: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
  log: '\u0416\u0443\u0440\u043d\u0430\u043b',
  feedback: '\u041e\u0431\u0440\u0430\u0442\u043d\u0430\u044f \u0441\u0432\u044f\u0437\u044c',
  usersCrm: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 CRM',
  loadFail: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439',
  reqErr: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u043f\u0440\u043e\u0441\u0430',
  fio: '\u0424\u0418\u041e',
  position: '\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c',
  phone: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d',
  office: '\u041a\u0430\u0431\u0438\u043d\u0435\u0442',
  schedShort: '\u0413\u0440\u0430\u0444\u0438\u043a \u0437\u0430\u043c.',
  active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
  yes: '\u0414\u0430',
  no: '\u041d\u0435\u0442',
  edit: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c',
  saved: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e',
  saveErr: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f',
  saveFail: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  refresh: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
  adminOnly: '\u0420\u0430\u0437\u0434\u0435\u043b \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430\u043c.',
  total: '\u0412\u0441\u0435\u0433\u043e:',
  activeN: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445:',
  schedN: '\u0413\u0440\u0430\u0444\u0438\u043a \u0437\u0430\u043c.:',
  searchPh: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0424\u0418\u041e, \u043b\u043e\u0433\u0438\u043d\u0443, email, \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0443',
  notFound: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b',
  user: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c',
  login: '\u041b\u043e\u0433\u0438\u043d:',
  schedPerm: '\u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0433\u0440\u0430\u0444\u0438\u043a\u0443 \u0437\u0430\u043c\u0435\u0441\u0442\u0438\u0442\u0435\u043b\u0435\u0439 (u_prem9)',
  activeAcc: '\u0410\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u0443\u0447\u0435\u0442\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
}

const defaultVue = `<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import { scheduleTitleOptions } from '../config/schedule'
import { useAuth } from '../composables/useAuth'
import { schedulePathForSlug } from '../utils/schedule'

const open = ref(false)
const { canViewLogs } = useAuth()

const scheduleNavChildren = scheduleTitleOptions.map(opt => ({
  label: opt.label,
  to: schedulePathForSlug(opt.value),
  exact: opt.value === 'general',
  icon: 'icon' in opt ? opt.icon : undefined,
  avatar: 'avatar' in opt ? opt.avatar : undefined,
  onSelect: () => {
    open.value = false
  },
})) satisfies NavigationMenuItem[]

const links = computed(() => {
  const scheduleGroup: NavigationMenuItem[] = [{
    slot: 'schedule-nav',
    label: '${ru.schedule}',
    icon: 'i-lucide-calendar-range',
    to: '/schedule',
    defaultOpen: true,
    type: 'trigger',
    children: scheduleNavChildren,
  }]

  const bottom: NavigationMenuItem[] = []

  if (canViewLogs.value) {
    bottom.push({
      label: '${ru.users}',
      icon: 'i-lucide-users',
      to: '/customers',
      onSelect: () => {
        open.value = false
      },
    })
    bottom.push({
      label: '${ru.log}',
      icon: 'i-lucide-scroll-text',
      to: '/logs',
      onSelect: () => {
        open.value = false
      },
    })
  }

  bottom.push({
    label: '${ru.feedback}',
    icon: 'i-lucide-message-circle',
    to: 'https://forms.yandex.ru/u/6a05984a902902136ca191e3',
    target: '_blank',
    onSelect: () => {
      open.value = false
    },
  })

  return [scheduleGroup, bottom] satisfies NavigationMenuItem[][]
})

function scheduleNavItem(item: unknown): NavigationMenuItem {
  return item as NavigationMenuItem
}
</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-default"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="(links[0] as NavigationMenuItem[])"
          orientation="vertical"
          tooltip
          :popover="{ content: { side: 'right', align: 'start', alignOffset: 2 } }"
        >
          <template #schedule-nav-content="{ item, ui }">
            <ul data-slot="childList" :class="ui.childList()">
              <li data-slot="childLabel" :class="ui.childLabel()">
                {{ scheduleNavItem(item).label }}
              </li>
              <li
                v-for="(childItem, childIndex) in scheduleNavItem(item).children || []"
                :key="childIndex"
                data-slot="childItem"
                :class="ui.childItem()"
              >
                <RouterLink
                  v-if="childItem.to"
                  v-slot="{ href, navigate, isActive, isExactActive }"
                  :to="childItem.to"
                  :exact="Boolean(childItem.exact)"
                  custom
                >
                  <a
                    :href="href"
                    data-slot="childLink"
                    :class="ui.childLink({
                      active: childItem.exact ? isExactActive : isActive,
                    })"
                    @click="(e) => {
                      navigate(e)
                      childItem.onSelect?.()
                    }"
                  >
                    <UAvatar
                      v-if="childItem.avatar"
                      v-bind="childItem.avatar"
                      size="2xs"
                      data-slot="linkLeadingAvatar"
                      :class="ui.linkLeadingAvatar({
                        active: childItem.exact ? isExactActive : isActive,
                      })"
                    />
                    <UIcon
                      v-else-if="childItem.icon"
                      :name="childItem.icon"
                      data-slot="childLinkIcon"
                      :class="ui.childLinkIcon({
                        active: childItem.exact ? isExactActive : isActive,
                      })"
                    />
                    <span
                      data-slot="childLinkLabel"
                      :class="ui.childLinkLabel({
                        active: childItem.exact ? isExactActive : isActive,
                      })"
                    >
                      {{ childItem.label }}
                    </span>
                  </a>
                </RouterLink>
              </li>
            </ul>
          </template>
        </UNavigationMenu>

        <UNavigationMenu
          v-if="links[1].length"
          :collapsed="collapsed"
          :items="(links[1] as NavigationMenuItem[])"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <RouterView />
  </UDashboardGroup>
</template>
`

const customersVue = `<script setup lang="ts">
import { computed, h, ref, resolveComponent, watch } from 'vue'
import { useHead } from '@unhead/vue'
import type { TableColumn } from '@nuxt/ui'
import { fetchCrmUsers, updateCrmUser, type ApiCrmUser } from '../api/crm-users'
import { useAuth } from '../composables/useAuth'

const emptyCell = '-'

useHead({ title: '${ru.usersCrm}' })

const { canViewLogs } = useAuth()
const toast = useToast()

const loading = ref(false)
const savingId = ref<number | null>(null)
const searchQuery = ref('')
const users = ref<ApiCrmUser[]>([])
const editOpen = ref(false)
const editUser = ref<ApiCrmUser | null>(null)

const draft = ref({
  phone: '',
  office: '',
  position: '',
  schedulePermission: false,
  active: true,
})

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const USwitch = resolveComponent('USwitch')

async function loadUsers() {
  loading.value = true
  try {
    users.value = await fetchCrmUsers(searchQuery.value)
  } catch (e) {
    users.value = []
    toast.add({
      title: '${ru.loadFail}',
      description: e instanceof Error ? e.message : '${ru.reqErr}',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadUsers(), 300)
})

watch(canViewLogs, (allowed) => {
  if (allowed)
    void loadUsers()
}, { immediate: true })

const activeCount = computed(() => users.value.filter(u => u.active).length)
const scheduleCount = computed(() => users.value.filter(u => u.schedulePermission).length)

const columns: TableColumn<ApiCrmUser>[] = [
  {
    accessorKey: 'name',
    header: '${ru.fio}',
    cell: ({ row }) => {
      const u = row.original
      return h('div', { class: 'min-w-0' }, [
        h('p', { class: 'font-medium text-highlighted truncate' }, u.name),
        h('p', { class: 'text-xs text-muted truncate' }, u.login),
      ])
    },
  },
  {
    accessorKey: 'position',
    header: '${ru.position}',
    cell: ({ row }) => h('span', { class: 'line-clamp-2 text-sm' }, row.original.position || emptyCell),
  },
  {
    accessorKey: 'phone',
    header: '${ru.phone}',
    cell: ({ row }) => row.original.phone || emptyCell,
  },
  {
    accessorKey: 'office',
    header: '${ru.office}',
    cell: ({ row }) => row.original.office || emptyCell,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => h('span', { class: 'line-clamp-2 text-sm text-muted' }, row.original.email || emptyCell),
  },
  {
    accessorKey: 'schedulePermission',
    header: '${ru.schedShort}',
    cell: ({ row }) => row.original.schedulePermission
      ? h(UBadge, { color: 'primary', variant: 'subtle', label: '${ru.yes}' })
      : h('span', { class: 'text-muted' }, emptyCell),
  },
  {
    accessorKey: 'active',
    header: '${ru.active}',
    cell: ({ row }) => row.original.active
      ? h(UBadge, { color: 'success', variant: 'subtle', label: '${ru.yes}' })
      : h(UBadge, { color: 'neutral', variant: 'subtle', label: '${ru.no}' }),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h(UButton, {
      label: '${ru.edit}',
      color: 'neutral',
      variant: 'ghost',
      size: 'sm',
      onClick: () => openEdit(row.original),
    }),
  },
]

function openEdit(user: ApiCrmUser) {
  editUser.value = user
  draft.value = {
    phone: user.phone,
    office: user.office,
    position: user.position,
    schedulePermission: user.schedulePermission,
    active: user.active,
  }
  editOpen.value = true
}

async function saveEdit() {
  const user = editUser.value
  if (!user)
    return

  savingId.value = user.id
  try {
    const updated = await updateCrmUser(user.id, { ...draft.value })
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx >= 0)
      users.value[idx] = updated
    editOpen.value = false
    toast.add({ title: '${ru.saved}', color: 'success' })
  } catch (e) {
    toast.add({
      title: '${ru.saveErr}',
      description: e instanceof Error ? e.message : '${ru.saveFail}',
      color: 'error',
    })
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="crm-users">
    <template #header>
      <UDashboardNavbar title="${ru.usersCrm}">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="loading"
            aria-label="${ru.refresh}"
            @click="loadUsers"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!canViewLogs" class="p-6 text-sm text-muted">
        ${ru.adminOnly}
      </div>

      <template v-else>
        <UContainer class="flex flex-col gap-4 py-4">
          <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>${ru.total} <strong class="text-default">{{ users.length }}</strong></span>
            <span>${ru.activeN} <strong class="text-default">{{ activeCount }}</strong></span>
            <span>${ru.schedN} <strong class="text-default">{{ scheduleCount }}</strong></span>
          </div>

          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="${ru.searchPh}"
            size="lg"
            class="w-full max-w-xl"
          />

          <UTable
            :data="users"
            :columns="columns"
            :loading="loading"
            class="shrink-0"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0 min-w-[960px]',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default align-top',
            }"
          />

          <p v-if="!loading && !users.length" class="text-center text-sm text-muted py-8">
            ${ru.notFound}
          </p>
        </UContainer>

        <UModal
          v-model:open="editOpen"
          :title="editUser ? editUser.name : '${ru.user}'"
          :description="editUser ? \`${ru.login} \${editUser.login}\` : undefined"
        >
          <template #body>
            <div class="flex flex-col gap-4">
              <UFormField label="${ru.position}">
                <UInput v-model="draft.position" />
              </UFormField>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="${ru.phone}">
                  <UInput v-model="draft.phone" />
                </UFormField>
                <UFormField label="${ru.office}">
                  <UInput v-model="draft.office" />
                </UFormField>
              </div>
              <USwitch
                v-model="draft.schedulePermission"
                label="${ru.schedPerm}"
              />
              <USwitch v-model="draft.active" label="${ru.activeAcc}" />
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="${ru.cancel}" color="neutral" variant="subtle" @click="editOpen = false" />
              <UButton
                label="${ru.save}"
                color="primary"
                :loading="savingId != null"
                @click="saveEdit"
              />
            </div>
          </template>
        </UModal>
      </template>
    </template>
  </UDashboardPanel>
</template>
`

fs.writeFileSync(path.join(root, 'src/layouts/default.vue'), defaultVue, 'utf8')
fs.writeFileSync(path.join(root, 'src/pages/customers.vue'), customersVue, 'utf8')
console.log('Wrote UTF-8 Vue files')
