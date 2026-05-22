<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  createCrmUser,
  updateCrmUser,
  type ApiCrmUser,
  type CrmUsersMetaResponse,
  type UpdateApiCrmUserPayload,
} from '../../api/crm-users'
import {
  emptyCrmPermissions,
  formatPermissionSummary,
  type CrmPermissionKey,
  type CrmUserPermissions,
} from '../../constants/crm-user-fields'

const t = {
  add: '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
  card: '\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
  edit: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435',
  main: '\u041e\u0441\u043d\u043e\u0432\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
  rights: '\u041f\u0440\u0430\u0432\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430',
  deputyBlock: '\u0417\u0430\u043c\u0435\u0441\u0442\u0438\u0442\u0435\u043b\u044c',
  active: '\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
  fio: '\u0424.\u0418.\u041e.',
  login: '\u041b\u043e\u0433\u0438\u043d',
  pass: '\u041f\u0430\u0440\u043e\u043b\u044c',
  passMasked: '******',
  email: '\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u0430\u044f \u043f\u043e\u0447\u0442\u0430',
  info: '\u041f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435',
  notes: '\u0421\u043f\u0438\u0441\u043e\u043a \u0430\u0434\u0440\u0435\u0441\u043e\u0432 \u0434\u043b\u044f \u043e\u043f\u043e\u0432\u0435\u0449\u0435\u043d\u0438\u0439',
  position: '\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c',
  phone: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d',
  office: '\u041a\u0430\u0431\u0438\u043d\u0435\u0442',
  schedPerm: '\u0413\u0440\u0430\u0444\u0438\u043a \u0437\u0430\u043c\u0435\u0441\u0442\u0438\u0442\u0435\u043b\u0435\u0439',
  deputy: '\u0417\u0430\u043c\u0435\u0441\u0442\u0438\u0442\u0435\u043b\u044c',
  secretary: '\u0421\u0435\u043a\u0440\u0435\u0442\u0430\u0440\u044c \u0434\u043b\u044f \u0437\u0430\u043c\u0430',
  deputyNone: '\u2014',
  yes: '\u0414\u0430',
  no: '\u041d\u0435\u0442',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  closeDiscard: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0431\u0435\u0437 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f',
  passPh: '\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043f\u0443\u0441\u0442\u044b\u043c, \u0447\u0442\u043e\u0431\u044b \u043d\u0435 \u043c\u0435\u043d\u044f\u0442\u044c',
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  user: ApiCrmUser | null
  meta: CrmUsersMetaResponse | null
  mode?: 'view' | 'create'
  saving?: boolean
}>()

const emit = defineEmits<{
  saved: [user: ApiCrmUser]
  created: [user: ApiCrmUser]
}>()

const editable = ref(false)
const localSaving = ref(false)

const isCreate = computed(() => props.mode === 'create' || !props.user)
const isEditing = computed(() => isCreate.value || editable.value)

const draft = ref({
  active: true,
  login: '',
  password: '',
  name: '',
  email: '',
  info: '',
  notes: '',
  position: '',
  phone: '',
  office: '',
  schedulePermission: false,
  isDeputy: false,
  deputyId: 0,
  permissions: emptyCrmPermissions(),
})

const USER_FORM_ID = 'crm-user-form'

const levelLabel = (value: number) =>
  props.meta?.accessLevels.find(l => l.value === value)?.label ?? String(value)

const activeItems = computed(() =>
  (props.meta?.activeLevels ?? [{ value: 1, label: t.yes }, { value: 0, label: t.no }])
    .map(l => ({ value: l.value === 1, label: l.label })),
)

const accessItems = computed(() =>
  (props.meta?.accessLevels ?? []).map(l => ({ value: l.value, label: l.label })),
)

const deputyItems = computed(() => [
  { value: 0, label: t.deputyNone },
  ...(props.meta?.deputies ?? []).map(d => ({ value: d.id, label: d.name })),
])

const permissionModules = computed(() => props.meta?.permissionModules ?? [])

const viewPermissionLines = computed(() => {
  if (!props.user || !props.meta)
    return []
  const lines = formatPermissionSummary(
    props.user.permissions,
    props.meta.permissionModules,
    levelLabel,
  )
  if (props.user.schedulePermission)
    lines.push(`${props.meta.scheduleModule.label}: ${t.yes}`)
  return lines
})

const deputyName = computed(() => {
  if (!props.user?.deputyId)
    return t.deputyNone
  return props.meta?.deputies.find(d => d.id === props.user!.deputyId)?.name ?? `#${props.user.deputyId}`
})

function syncDraftFromUser(user: ApiCrmUser) {
  draft.value = {
    active: user.active,
    login: user.login,
    password: user.password,
    name: user.name,
    email: user.email,
    info: user.info,
    notes: user.notes,
    position: user.position,
    phone: user.phone,
    office: user.office,
    schedulePermission: user.schedulePermission,
    isDeputy: user.isDeputy,
    deputyId: user.deputyId,
    permissions: { ...user.permissions },
  }
}

function resetCreateDraft() {
  draft.value = {
    active: true,
    login: '',
    password: '',
    name: '',
    email: '',
    info: '',
    notes: '',
    position: '',
    phone: '',
    office: '',
    schedulePermission: false,
    isDeputy: false,
    deputyId: 0,
    permissions: emptyCrmPermissions(),
  }
}

watch(
  () => [props.user, props.mode] as const,
  ([user, mode]) => {
    if (mode === 'create' || !user) {
      resetCreateDraft()
      editable.value = true
      return
    }
    syncDraftFromUser(user)
    editable.value = false
  },
  { immediate: true, deep: true },
)

watch(open, (isOpen) => {
  if (!isOpen) {
    editable.value = false
    return
  }
  if (isCreate.value)
    resetCreateDraft()
  else if (props.user)
    syncDraftFromUser(props.user)
})

function onCancelEdit() {
  if (isCreate.value) {
    open.value = false
    return
  }
  if (props.user)
    syncDraftFromUser(props.user)
  editable.value = false
}

function onClose() {
  if (isEditing.value && !isCreate.value)
    onCancelEdit()
  open.value = false
}

function buildPayload(): UpdateApiCrmUserPayload {
  const payload: UpdateApiCrmUserPayload = {
    active: draft.value.active,
    login: draft.value.login.trim(),
    name: draft.value.name.trim(),
    email: draft.value.email.trim(),
    info: draft.value.info.trim(),
    notes: draft.value.notes.trim(),
    position: draft.value.position.trim(),
    phone: draft.value.phone.trim(),
    office: draft.value.office.trim(),
    schedulePermission: draft.value.schedulePermission,
    isDeputy: draft.value.isDeputy,
    deputyId: draft.value.isDeputy ? 0 : draft.value.deputyId,
    permissions: { ...draft.value.permissions },
  }
  const pass = draft.value.password.trim()
  if (pass)
    payload.password = pass
  return payload
}

async function onSubmit() {
  localSaving.value = true
  try {
    if (isCreate.value) {
      const payload = buildPayload()
      if (!payload.login || !payload.name || !draft.value.password.trim()) {
        localSaving.value = false
        return
      }
      const user = await createCrmUser({
        active: payload.active ?? true,
        login: payload.login!,
        password: draft.value.password.trim(),
        name: payload.name!,
        email: payload.email,
        info: payload.info,
        notes: payload.notes,
        position: payload.position,
        phone: payload.phone,
        office: payload.office,
        schedulePermission: payload.schedulePermission,
        isDeputy: payload.isDeputy,
        deputyId: payload.deputyId,
        permissions: payload.permissions,
      })
      emit('created', user)
      open.value = false
      return
    }

    if (!props.user)
      return

    const user = await updateCrmUser(props.user.id, buildPayload())
    emit('saved', user)
    editable.value = false
  } finally {
    localSaving.value = false
  }
}

function permValue(key: CrmPermissionKey): number {
  return draft.value.permissions[key] ?? 0
}

function setPermValue(key: CrmPermissionKey, value: number) {
  draft.value.permissions[key] = value
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :close="false"
    :ui="{
      content: 'w-full max-w-[min(100vw,640px)] sm:max-w-[640px]',
      overlay: 'backdrop-blur-[5px] bg-elevated/40',
      body: 'flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6',
      footer: 'border-t border-default bg-default shrink-0',
    }"
  >
    <template #header>
      <div class="flex w-full items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <p class="text-base font-semibold text-highlighted" role="heading" :aria-level="2">
            {{ isCreate ? t.add : (isEditing ? t.edit : t.card) }}
          </p>
          <p v-if="user && !isCreate" class="mt-1 truncate text-sm text-muted">
            {{ user.name }}
          </p>
          <p v-if="user && !isCreate" class="truncate text-xs text-dimmed">
            {{ user.login }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            v-if="user && !isEditing"
            :label="t.edit"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-pencil"
            @click="editable = true"
          />
          <UButton
            color="neutral"
            variant="ghost"
            square
            icon="i-lucide-x"
            :aria-label="isEditing && !isCreate ? t.closeDiscard : t.close"
            @click="onClose"
          />
        </div>
      </div>
    </template>

    <template #body>
      <form
        :id="USER_FORM_ID"
        class="flex flex-col gap-6"
        @submit.prevent="onSubmit"
      >
        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold text-highlighted">
            {{ t.main }}
          </h3>

          <template v-if="!isEditing && user">
            <dl class="grid gap-3 text-sm">
              <div>
                <dt class="text-xs text-muted">{{ t.active }}</dt>
                <dd class="mt-0.5">{{ user.active ? t.yes : t.no }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.fio }}</dt>
                <dd class="mt-0.5 font-medium">{{ user.name }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.login }}</dt>
                <dd class="mt-0.5">{{ user.login }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.pass }}</dt>
                <dd class="mt-0.5 font-mono text-sm">
                  {{ user.passwordMasked ? t.passMasked : (user.password || '—') }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.email }}</dt>
                <dd class="mt-0.5 break-words">{{ user.email || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.info }}</dt>
                <dd class="mt-0.5 break-words">{{ user.info || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.notes }}</dt>
                <dd class="mt-0.5 break-words text-muted">{{ user.notes || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ t.position }}</dt>
                <dd class="mt-0.5">{{ user.position || '—' }}</dd>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-xs text-muted">{{ t.phone }}</dt>
                  <dd class="mt-0.5">{{ user.phone || '—' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">{{ t.office }}</dt>
                  <dd class="mt-0.5">{{ user.office || '—' }}</dd>
                </div>
              </div>
            </dl>
          </template>

          <template v-else>
            <UFormField :label="t.active">
              <USelect
                :model-value="draft.active"
                :items="activeItems"
                value-key="value"
                label-key="label"
                class="w-full"
                @update:model-value="draft.active = $event as boolean"
              />
            </UFormField>
            <UFormField :label="t.fio" required>
              <UInput v-model="draft.name" required />
            </UFormField>
            <UFormField :label="t.login" required>
              <UInput v-model="draft.login" required />
            </UFormField>
            <UFormField :label="t.pass" :required="isCreate">
              <UInput
                v-model="draft.password"
                :placeholder="isCreate ? '' : t.passPh"
                :required="isCreate"
              />
            </UFormField>
            <UFormField :label="t.email">
              <UInput v-model="draft.email" />
            </UFormField>
            <UFormField :label="t.info">
              <UInput v-model="draft.info" />
            </UFormField>
            <UFormField :label="t.notes">
              <UTextarea v-model="draft.notes" :rows="2" autoresize />
            </UFormField>
            <UFormField :label="t.position">
              <UInput v-model="draft.position" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t.phone">
                <UInput v-model="draft.phone" />
              </UFormField>
              <UFormField :label="t.office">
                <UInput v-model="draft.office" />
              </UFormField>
            </div>
          </template>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold text-highlighted">
            {{ t.rights }}
          </h3>

          <template v-if="!isEditing && user">
            <ul v-if="viewPermissionLines.length" class="list-none space-y-1 text-sm text-muted">
              <li v-for="(line, i) in viewPermissionLines" :key="i">
                {{ line }}
              </li>
            </ul>
            <p v-else class="text-sm text-muted">
              —
            </p>
          </template>

          <template v-else>
            <UFormField
              v-for="mod in permissionModules"
              :key="mod.key"
              :label="mod.label"
            >
              <USelect
                :model-value="permValue(mod.key)"
                :items="accessItems"
                value-key="value"
                label-key="label"
                class="w-full"
                @update:model-value="setPermValue(mod.key, $event as number)"
              />
            </UFormField>
            <USwitch
              v-model="draft.schedulePermission"
              :label="meta?.scheduleModule.label ?? t.schedPerm"
            />
          </template>
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold text-highlighted">
            {{ t.deputyBlock }}
          </h3>

          <template v-if="!isEditing && user">
            <dl class="grid gap-2 text-sm">
              <div>
                <dt class="text-xs text-muted">{{ t.deputy }}</dt>
                <dd class="mt-0.5">{{ user.isDeputy ? t.yes : t.no }}</dd>
              </div>
              <div v-if="!user.isDeputy">
                <dt class="text-xs text-muted">{{ t.secretary }}</dt>
                <dd class="mt-0.5">{{ deputyName }}</dd>
              </div>
            </dl>
          </template>

          <template v-else>
            <UFormField :label="t.deputy">
              <USelect
                :model-value="draft.isDeputy"
                :items="[{ value: false, label: t.no }, { value: true, label: t.yes }]"
                value-key="value"
                label-key="label"
                class="w-full"
                @update:model-value="draft.isDeputy = $event as boolean"
              />
            </UFormField>
            <UFormField v-if="!draft.isDeputy" :label="t.secretary">
              <USelect
                v-model="draft.deputyId"
                :items="deputyItems"
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>
          </template>
        </section>
      </form>
    </template>

    <template v-if="isEditing" #footer>
      <div class="flex w-full gap-2">
        <UButton
          :label="t.cancel"
          color="neutral"
          variant="subtle"
          class="w-full justify-center"
          size="lg"
          @click="onCancelEdit"
        />
        <UButton
          :label="t.save"
          color="primary"
          class="w-full justify-center"
          size="lg"
          type="submit"
          :form="USER_FORM_ID"
          :loading="saving || localSaving"
        />
      </div>
    </template>

    <template v-else-if="user" #footer>
      <UButton
        :label="t.edit"
        color="primary"
        class="w-full justify-center"
        size="lg"
        icon="i-lucide-pencil"
        @click="editable = true"
      />
    </template>
  </USlideover>
</template>
