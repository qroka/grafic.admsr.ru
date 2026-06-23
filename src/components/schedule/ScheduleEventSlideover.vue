<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import {
  findScheduleBlockIdByDate,
  formatAttachmentsLabel,
  formatScheduleCreatedAtNow,
  formatSchedulePlace,
  ensureScheduleRowDetailMeta,
  getScheduleRowCreatedAt,
  downloadScheduleFile,
  previewScheduleFile,
  scheduleFileDisplaySize,
  parseDateFromScheduleBlockTitle,
  scheduleParticipantKey,
  isScheduleRowViewRestricted,
  formatScheduleRowTime,
} from '../../utils/schedule'
import type {
  ScheduleAttachmentFile,
  ScheduleDateBlock,
  ScheduleParticipant,
  ScheduleRow,
  ScheduleUserGroup,
} from '../../types/schedule'
import {
  downloadEventAttachment,
  previewEventAttachment,
} from '../../api/attachments'
import { figmaScheduleAssets } from '../../config/figma-mcp-assets'
import { UPLOAD_MAX_SIZE_LABEL, validateUploadFile } from '../../config/uploads'
import { useAuth } from '../../composables/useAuth'
import ScheduleAttachmentList from './ScheduleAttachmentList.vue'
import ScheduleDatePicker from './ScheduleDatePicker.vue'
import ScheduleParticipantPopoverChip from './ScheduleParticipantPopoverChip.vue'
import ScheduleParticipantsField from './ScheduleParticipantsField.vue'
import ScheduleTimePicker from './ScheduleTimePicker.vue'
import ScheduleHiddenBadge from './ScheduleHiddenBadge.vue'
import ScheduleHiddenEventLabel from './ScheduleHiddenEventLabel.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  selection: {
    block: ScheduleDateBlock
    group: ScheduleUserGroup
    row: ScheduleRow
  } | null
  /** Режим редактирования: поля активны, внизу «Отмена» / «Сохранить». */
  editable?: boolean
  /** Можно перейти в редактирование из режима просмотра. */
  canEdit?: boolean
  /** Создание нового мероприятия (только персональный график заместителя). */
  isCreate?: boolean
  /** Блоки дней графика для выбора даты при создании. */
  createDayBlocks?: ScheduleDateBlock[]
  /** Список участников для выбора в форме. */
  availableParticipants?: ScheduleParticipant[]
}>()

const createDayBlockId = defineModel<string>('createDayBlockId')

const { user: authUser } = useAuth()

const emit = defineEmits<{
  saved: []
  edit: []
}>()

const editable = computed(() => Boolean(props.editable || props.isCreate))
const isCreate = computed(() => Boolean(props.isCreate))
const isReadOnly = computed(() => Boolean(props.selection) && !editable.value && !isCreate.value)
const viewRestricted = computed(() =>
  props.selection ? isScheduleRowViewRestricted(props.selection.row) : false,
)

const d = computed(() => props.selection?.row.detail)

const draft = reactive({
  date: '',
  time: '',
  allDay: false,
  hidden: false,
  address: '',
  topic: '',
})

const selectedParticipantKeys = ref<string[]>([])
const attachmentItems = ref<ScheduleAttachmentFile[]>([])

const EVENT_FORM_ID = 'schedule-event-form'
const toast = useToast()

function removeAttachmentAt(index: number) {
  attachmentItems.value = attachmentItems.value.filter((_, i) => i !== index)
}

function addPendingFiles(files: File[] | null | undefined) {
  if (!files?.length)
    return
  for (const file of files) {
    const validationError = validateUploadFile(file)
    if (validationError) {
      toast.add({
        title: 'Файл не добавлен',
        description: validationError,
        color: 'error',
      })
      continue
    }
    attachmentItems.value.push({
      name: file.name,
      size: scheduleFileDisplaySize(file),
      pendingFile: file,
    })
  }
}

async function previewAttachment(item: ScheduleAttachmentFile) {
  if (item.id)
    await previewEventAttachment(item.id)
  else if (item.pendingFile)
    previewScheduleFile(item.pendingFile)
}

async function downloadAttachment(item: ScheduleAttachmentFile) {
  if (item.id)
    await downloadEventAttachment(item.id, item.name)
  else if (item.pendingFile)
    downloadScheduleFile(item.pendingFile)
}

const participantsByKey = computed(() => {
  const map = new Map<string, ScheduleParticipant>()
  for (const participant of props.availableParticipants ?? [])
    map.set(scheduleParticipantKey(participant), participant)
  for (const participant of props.selection?.row.participants ?? []) {
    const key = scheduleParticipantKey(participant)
    if (!map.has(key))
      map.set(key, participant)
  }
  return map
})

const participantsForField = computed(() => [...participantsByKey.value.values()])

const selectedParticipants = computed(() =>
  selectedParticipantKeys.value
    .map(key => participantsByKey.value.get(key))
    .filter((p): p is ScheduleParticipant => Boolean(p)),
)

function syncDraftFromSelection() {
  const s = props.selection
  if (!s) {
    return
  }
  const r = s.row
  const bd = parseDateFromScheduleBlockTitle(s.block.title)
  if (bd)
    ensureScheduleRowDetailMeta(r, bd)
  draft.time = r.time
  draft.address = formatSchedulePlace(r)
  draft.topic = r.topic
  draft.date = r.detail?.date ?? bd ?? ''
  draft.allDay = r.detail?.allDay ?? false
  draft.hidden = r.hidden ?? false
  selectedParticipantKeys.value = r.participants.map(scheduleParticipantKey)
  attachmentItems.value = r.attachmentFiles.map(f => ({ ...f }))
}

watch(
  () => props.selection,
  (s) => {
    if (s)
      syncDraftFromSelection()
  },
  { immediate: true },
)

watch(
  () => draft.allDay,
  (allDay) => {
    if (allDay)
      draft.time = ''
  },
)

watch(
  () => draft.date,
  (dateStr) => {
    if (!isCreate.value || !dateStr || !props.createDayBlocks?.length)
      return
    const blockId = findScheduleBlockIdByDate(props.createDayBlocks, dateStr)
    if (blockId && createDayBlockId.value !== blockId)
      createDayBlockId.value = blockId
  },
)

/** Дата создания записи (не дата проведения мероприятия). */
const headerCreatedAt = computed(() => {
  if (isCreate.value)
    return formatScheduleCreatedAtNow()
  const s = props.selection
  if (!s)
    return ''
  return getScheduleRowCreatedAt(s.row)
})

const headerCreatorParticipant = computed((): ScheduleParticipant | null => {
  if (d.value?.creator)
    return d.value.creator
  if (isCreate.value && authUser.value?.name?.trim()) {
    const name = authUser.value.name.trim()
    return {
      externalId: authUser.value.externalUserId ?? undefined,
      name,
      avatarSrc: figmaScheduleAssets.avatar,
      card: {
        line1: name,
        line2: '',
        email: authUser.value.email ?? '',
        phone: '',
        address: '',
      },
    }
  }
  return null
})

function validateEventForm(state: typeof draft): FormError[] {
  const errors: FormError[] = []
  if (!state.date.trim())
    errors.push({ name: 'date', message: 'Укажите дату' })
  if (!state.allDay && !/^\d{1,2}:\d{2}$/.test(state.time.trim()))
    errors.push({ name: 'time', message: 'Укажите время' })
  if (!state.address.trim())
    errors.push({ name: 'address', message: 'Укажите адрес проведения' })
  if (!state.topic.trim())
    errors.push({ name: 'topic', message: 'Укажите тему мероприятия' })
  return errors
}

function applyDraftToRow() {
  const s = props.selection
  if (!s)
    return
  const r = s.row
  r.time = draft.allDay ? '' : draft.time
  r.placeLabel = ''
  r.placeAddress = draft.address.trim()
  r.topic = draft.topic
  r.participants = [...selectedParticipants.value]
  if (!r.detail)
    r.detail = {}
  if (isCreate.value) {
    const creator = headerCreatorParticipant.value
    if (creator)
      r.detail.creator = creator
  }
  r.detail.date = draft.date
  r.detail.allDay = draft.allDay
  if (!r.apiId && !r.detail.createdAt && !isCreate.value) {
    const eventDate = draft.date || parseDateFromScheduleBlockTitle(s.block.title) || ''
    ensureScheduleRowDetailMeta(r, eventDate)
  }
  r.hidden = draft.hidden
  r.attachmentFiles = attachmentItems.value.map(item => ({ ...item }))
  r.attachmentsLabel = formatAttachmentsLabel(r.attachmentFiles.length)
}

function onFormSubmit(_event: FormSubmitEvent<typeof draft>) {
  applyDraftToRow()
  emit('saved')
  open.value = false
}

function onCancelEdit() {
  syncDraftFromSelection()
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :close="false"
    :ui="{
      content: 'w-full max-w-[min(100vw,620px)] sm:max-w-[620px]',
      overlay: 'backdrop-blur-[5px] bg-elevated/40',
      body: 'flex min-h-0 flex-1 flex-col overflow-y-auto p-0',
      footer: 'border-t border-default bg-default shrink-0'
    }"
  >
    <template v-if="selection" #header>
      <div class="flex w-full items-start justify-between gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="text-base font-semibold text-highlighted" role="heading" :aria-level="2">
            {{
              isCreate
                ? 'Новое мероприятие'
                : editable
                  ? 'Редактирование мероприятия'
                  : 'Мероприятие'
            }}
          </p>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <ScheduleHiddenBadge
              v-if="selection.row.hidden && !viewRestricted"
              variant="badge"
            />
            <span v-if="headerCreatedAt">{{ headerCreatedAt }}</span>
            <template v-if="headerCreatorParticipant">
              <span
                v-if="headerCreatedAt"
                class="text-dimmed"
                aria-hidden="true"
              >·</span>
              <span class="text-xs text-dimmed">Создатель</span>
              <ScheduleParticipantPopoverChip
                variant="header"
                is-creator
                :participant="headerCreatorParticipant"
              />
            </template>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          square
          icon="i-lucide-x"
          class="shrink-0"
          :aria-label="editable ? 'Закрыть без сохранения' : 'Закрыть'"
          @click="editable ? onCancelEdit() : (open = false)"
        />
      </div>
    </template>

    <template v-if="selection" #body>
      <div class="flex flex-col gap-4">
        <div
          v-if="viewRestricted && !editable"
          class="flex flex-col gap-4"
        >
          <ScheduleHiddenEventLabel />
          <div class="grid grid-cols-2 gap-4 sm:max-w-sm">
            <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
              <p class="text-xs text-dimmed">
                Дата
              </p>
              <p class="mt-1 font-medium text-default tabular-nums">
                {{ draft.date || '—' }}
              </p>
            </UCard>
            <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
              <p class="text-xs text-dimmed">
                Время
              </p>
              <p class="mt-1 font-medium text-default tabular-nums">
                {{ formatScheduleRowTime(selection.row) }}
              </p>
            </UCard>
          </div>
        </div>

        <div
          v-else-if="isReadOnly"
          class="flex flex-col gap-4"
        >
          <p class="text-lg font-semibold leading-snug text-highlighted">
            {{ selection.row.topic }}
          </p>

          <div class="grid gap-3 sm:grid-cols-2">
            <UCard variant="subtle" :ui="{ body: 'flex items-start gap-3 p-3 sm:p-4' }">
              <UIcon name="i-lucide-calendar" class="mt-0.5 size-4 shrink-0 text-dimmed" />
              <div>
                <p class="text-xs text-dimmed">
                  Дата и время
                </p>
                <p class="mt-1 text-sm font-medium text-default">
                  {{ draft.date || '—' }}
                  <span class="text-muted">·</span>
                  <span class="tabular-nums">{{ formatScheduleRowTime(selection.row) }}</span>
                </p>
              </div>
            </UCard>

            <UCard variant="subtle" :ui="{ body: 'flex items-start gap-3 p-3 sm:p-4' }">
              <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0 text-dimmed" />
              <div class="min-w-0">
                <p class="text-xs text-dimmed">
                  Место
                </p>
                <p class="mt-1 text-sm font-medium text-default">
                  {{ draft.address || '—' }}
                </p>
              </div>
            </UCard>
          </div>

          <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
            <p class="mb-2 text-xs text-dimmed">
              Участники
            </p>
            <div v-if="selectedParticipants.length" class="flex flex-wrap gap-2">
              <ScheduleParticipantPopoverChip
                v-for="participant in selectedParticipants"
                :key="scheduleParticipantKey(participant)"
                variant="field"
                :participant="participant"
              />
            </div>
            <p v-else class="text-sm text-muted">
              Участники не указаны
            </p>
          </UCard>

          <UCard variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
            <p class="mb-2 text-xs text-dimmed">
              Приложения
            </p>
            <ScheduleAttachmentList :files="selection.row.attachmentFiles" />
          </UCard>
        </div>

        <UForm
          v-else
          :id="EVENT_FORM_ID"
          :state="draft"
          :validate="validateEventForm"
          class="flex flex-col gap-4"
          @submit="onFormSubmit"
        >
          <UCard variant="subtle" :ui="{ body: 'flex flex-col gap-3 p-3 sm:p-4' }">
            <USwitch
              v-model="draft.hidden"
              :disabled="!editable"
              label="Скрыть мероприятие"
              description="Скрытые мероприятия видят не все пользователи"
            />
            <UAlert
              v-if="draft.hidden"
              color="warning"
              variant="subtle"
              icon="i-lucide-info"
              title="Мероприятие будет скрыто"
              description="В общем графике другие пользователи увидят только дату и время, если у них нет доступа."
            />
          </UCard>

          <UCard variant="subtle" :ui="{ body: 'flex flex-col gap-4 p-3 sm:p-4' }">
            <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
              Когда
            </p>
            <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
              <UFormField label="Дата" name="date" class="w-full shrink-0 sm:w-64">
                <ScheduleDatePicker
                  v-model="draft.date"
                  :disabled="!editable"
                />
              </UFormField>
              <UFormField v-if="!draft.allDay" label="Время" name="time" class="min-w-0 flex-1">
                <ScheduleTimePicker
                  v-model="draft.time"
                  :disabled="!editable"
                  placeholder="09:00"
                />
              </UFormField>
            </div>

            <USwitch
              v-model="draft.allDay"
              :disabled="!editable"
              label="Весь день"
            />
          </UCard>

          <UCard variant="subtle" :ui="{ body: 'flex flex-col gap-4 p-3 sm:p-4' }">
            <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
              Описание
            </p>
            <UFormField label="Адрес" name="address">
              <UInput
                v-model="draft.address"
                :disabled="!editable"
                variant="outline"
                icon="i-lucide-map-pin"
                placeholder="Укажите адрес проведения"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Тема" name="topic">
              <UTextarea
                v-model="draft.topic"
                :disabled="!editable"
                variant="outline"
                placeholder="Кратко опишите тему мероприятия"
                :rows="4"
                autoresize
                class="w-full"
              />
            </UFormField>
          </UCard>

          <UCard variant="subtle" :ui="{ body: 'flex flex-col gap-4 p-3 sm:p-4' }">
            <p class="text-xs font-medium tracking-wide text-dimmed uppercase">
              Участники и файлы
            </p>
            <UFormField label="Участники">
              <ScheduleParticipantsField
                v-model="selectedParticipantKeys"
                :available-participants="participantsForField"
                :disabled="!editable"
              />
            </UFormField>

            <UFormField label="Приложения">
              <ScheduleAttachmentList
                v-if="!editable"
                :files="selection.row.attachmentFiles"
              />
              <div v-else class="flex flex-col gap-3">
            <ul v-if="attachmentItems.length" class="flex flex-col gap-2">
              <li
                v-for="(item, index) in attachmentItems"
                :key="item.id ?? `pending-${item.name}-${index}`"
                class="flex items-center gap-2 rounded-md border border-default px-2.5 py-2"
              >
                <div class="flex shrink-0 items-center rounded-full bg-elevated p-2">
                  <UIcon name="i-lucide-file" class="size-4 text-muted" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-default">
                    {{ item.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ item.size }}{{ item.pendingFile ? ' · будет загружен' : '' }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    square
                    size="sm"
                    icon="i-lucide-eye"
                    aria-label="Просмотреть"
                    @click="previewAttachment(item)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    square
                    size="sm"
                    icon="i-lucide-download"
                    aria-label="Скачать"
                    @click="downloadAttachment(item)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    square
                    size="sm"
                    icon="i-lucide-x"
                    aria-label="Удалить"
                    @click="removeAttachmentAt(index)"
                  />
                </div>
              </li>
            </ul>
            <UFileUpload
              :model-value="[]"
              multiple
              layout="list"
              position="outside"
              :interactive="false"
              icon="i-lucide-paperclip"
              label="Добавить файлы"
              :description="`До ${UPLOAD_MAX_SIZE_LABEL} на файл`"
              class="w-full min-h-24"
              @update:model-value="addPendingFiles"
            >
              <template #actions="{ open: openFileDialog }">
                <UButton
                  label="Выбрать файлы"
                  icon="i-lucide-upload"
                  color="neutral"
                  variant="outline"
                  @click="openFileDialog()"
                />
              </template>
            </UFileUpload>
              </div>
            </UFormField>
          </UCard>
        </UForm>
      </div>
    </template>

    <template v-if="selection && isReadOnly && canEdit" #footer>
      <UButton
        label="Редактировать"
        icon="i-lucide-pencil"
        color="primary"
        size="lg"
        block
        @click="emit('edit')"
      />
    </template>

    <template v-else-if="selection && (editable || isCreate)" #footer>
      <div class="flex w-full gap-2">
        <UButton
          label="Отмена"
          color="neutral"
          variant="subtle"
          class="w-full justify-center"
          size="lg"
          @click="onCancelEdit"
        />
        <UButton
          :label="isCreate ? 'Создать' : 'Сохранить'"
          color="primary"
          class="w-full justify-center"
          size="lg"
          type="submit"
          :form="EVENT_FORM_ID"
        />
      </div>
    </template>
  </USlideover>
</template>
