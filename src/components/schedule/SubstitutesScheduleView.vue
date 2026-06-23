<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter } from 'vue-router'
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  scheduleNavbarAvatar,
  scheduleNavbarHeading,
  scheduleTitleOptions,
} from '../../config/schedule'
import { useParticipants } from '../../composables/useParticipants'
import { usePermissions } from '../../composables/usePermissions'
import { useScheduleApi } from '../../composables/useScheduleApi'
import type {
  ScheduleAttachmentFile,
  ScheduleDateBlock,
  ScheduleDayEntry,
  ScheduleParticipant,
  ScheduleRow,
  ScheduleSubstituteSlug,
  ScheduleTitleValue,
  ScheduleUserGroup,
} from '../../types/schedule'
import {
  collectBlockEntriesSortedByTime,
  createEmptyScheduleRow,
  filterScheduleBlocks,
  filterScheduleBySubstitute,
  ensureSubstituteGroup,
  formatSchedulePlace,
  formatScheduleRowTime,
  isScheduleRowAllDay,
  isScheduleRowViewRestricted,
  buildScheduleDayBlockHeading,
  parseDateFromScheduleBlockTitle,
  parseScheduleSlugFromPath,
  scheduleParticipantKey,
  schedulePathForSlug,
} from '../../utils/schedule'
import ScheduleAttachmentsPopover from './ScheduleAttachmentsPopover.vue'
import ScheduleEventSlideover from './ScheduleEventSlideover.vue'
import ScheduleHiddenBadge from './ScheduleHiddenBadge.vue'
import ScheduleHiddenEventLabel from './ScheduleHiddenEventLabel.vue'
import ScheduleParticipantPopoverChip from './ScheduleParticipantPopoverChip.vue'

/** Карточка на доске: столбец = день (`ScheduleDateBlock`). */
interface ScheduleBoardCard {
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
  cardKey: string
}

interface ScheduleBoardColumn {
  block: ScheduleDateBlock
  cards: ScheduleBoardCard[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { loadBlocks, saveEvent, deleteEvent, loading: scheduleLoading, error: scheduleError } = useScheduleApi()
const { participants: crmParticipants, load: loadParticipants } = useParticipants()
const { canEditSchedule, canEditSubstituteSlug } = usePermissions()

const view = ref<'list' | 'board'>('list')

const scheduleBlocks = ref<ScheduleDateBlock[]>([])

async function refreshSchedule() {
  scheduleBlocks.value = await loadBlocks()
}

onMounted(async () => {
  await Promise.all([refreshSchedule(), loadParticipants()])
})

const scope = computed<ScheduleTitleValue>(() => parseScheduleSlugFromPath(route.path))

const isScheduleGeneralView = computed(() => scope.value === 'general')

const canCreateEvents = computed(() =>
  canEditSchedule(substituteSlug.value),
)

function canEditGroup(group: ScheduleUserGroup): boolean {
  return !isScheduleGeneralView.value && canEditSubstituteSlug(group.substituteKey)
}

const substituteSlug = computed(() =>
  isScheduleGeneralView.value ? null : scope.value as ScheduleSubstituteSlug)

const scheduleGridTemplate = computed(() =>
  isScheduleGeneralView.value
    ? '77px 200px 256px 1fr 1fr 140px'
    : '77px 256px 1fr 1fr 140px 52px')

/** Объединение колонок «место … приложения» для скрытого мероприятия без доступа к деталям. */
function hiddenEventDetailsGridColumn(generalView: boolean): string {
  return generalView ? '2 / 7' : '2 / 6'
}

const visibleBlocks = computed(() =>
  filterScheduleBySubstitute(scheduleBlocks.value, scope.value))

const searchQuery = ref('')
const selectedParticipantKeys = ref<string[]>([])

const scheduleParticipants = computed(() => crmParticipants.value)

const participantSelectItems = computed(() =>
  scheduleParticipants.value.map((p: ScheduleParticipant) => ({
    label: p.name,
    value: scheduleParticipantKey(p),
    avatar: { src: p.avatarSrc, alt: p.name }
  })))

const filteredBlocks = computed(() =>
  filterScheduleBlocks(
    visibleBlocks.value,
    searchQuery.value,
    selectedParticipantKeys.value
  ))

const hasActiveFilters = computed(() =>
  searchQuery.value.trim().length > 0 || selectedParticipantKeys.value.length > 0)

function resetScheduleFilters() {
  searchQuery.value = ''
  selectedParticipantKeys.value = []
}

watch(scope, () => {
  selectedParticipantKeys.value = selectedParticipantKeys.value.filter(key =>
    scheduleParticipants.value.some(p => scheduleParticipantKey(p) === key)
  )
})

/** «Сегодня 12.05.2026» одним куском (tabular-nums), день недели отдельно. */
const dayBlockHeadings = computed(() => {
  const out = new Map<string, { dayAndDate: string; weekday: string }>()
  for (const b of filteredBlocks.value) {
    const heading = buildScheduleDayBlockHeading(b.title)
    if (heading)
      out.set(b.id, heading)
  }
  return out
})

function dayEntries(block: ScheduleDateBlock): ScheduleDayEntry[] {
  return collectBlockEntriesSortedByTime(block)
}

function dayEventCount(block: ScheduleDateBlock): number {
  return dayEntries(block).length
}

const emptyStateTitle = computed(() =>
  hasActiveFilters.value
    ? 'Ничего не найдено'
    : 'В графике пока нет мероприятий',
)

const emptyStateDescription = computed(() =>
  hasActiveFilters.value
    ? 'Попробуйте изменить запрос или сбросить фильтры.'
    : canCreateEvents.value
      ? 'Добавьте первое мероприятие — оно появится в списке и на доске.'
      : 'Мероприятия появятся здесь, когда их добавят в график.',
)

const emptyStateActions = computed(() => {
  const actions: { label: string, icon: string, color?: 'primary' | 'neutral', variant?: 'solid' | 'outline' | 'soft', onClick: () => void }[] = []
  if (hasActiveFilters.value) {
    actions.push({
      label: 'Сбросить фильтры',
      icon: 'i-lucide-filter-x',
      color: 'neutral',
      variant: 'outline',
      onClick: resetScheduleFilters,
    })
  }
  if (canCreateEvents.value) {
    actions.push({
      label: 'Добавить мероприятие',
      icon: 'i-lucide-plus',
      color: 'primary',
      variant: 'solid',
      onClick: () => onCreateEvent(),
    })
  }
  return actions
})

function dayEntryKey(blockId: string, entry: ScheduleDayEntry, index: number): string {
  return `${blockId}-${entry.group.substituteKey}-${index}-${isScheduleRowAllDay(entry.row) ? 'all-day' : entry.row.time}`
}

const boardColumns = computed<ScheduleBoardColumn[]>(() =>
  filteredBlocks.value.map(block => ({
    block,
    cards: dayEntries(block).map((entry, index) => ({
      block,
      group: entry.group,
      row: entry.row,
      cardKey: dayEntryKey(block.id, entry, index)
    }))
  }))
)

function boardCardDisplayId(cardKey: string): string {
  let h = 0
  for (let i = 0; i < cardKey.length; i++)
    h = (Math.imul(31, h) + cardKey.charCodeAt(i)) >>> 0
  return `#${(h % 900) + 100}`
}

function accentCardTopBorder(accent: ScheduleUserGroup['accent']): string {
  const map: Record<ScheduleUserGroup['accent'], string> = {
    rose: 'border-t-4 border-t-[#e7000b]',
    blue: 'border-t-4 border-t-[#155dfc]',
    violet: 'border-t-4 border-t-[#7c3aed]',
    amber: 'border-t-4 border-t-[#d97706]',
    emerald: 'border-t-4 border-t-[#059669]'
  }
  return map[accent]
}

const pageTitle = computed(() =>
  scope.value === 'general'
    ? 'График заместителей — общий'
    : scheduleNavbarHeading(scope.value))

useHead({
  title: pageTitle
})

const titleMenuItems = computed<DropdownMenuItem[][]>(() => [
  scheduleTitleOptions.map(opt => ({
    label: opt.label,
    description: 'description' in opt
      ? (opt as { description?: string }).description
      : undefined,
    icon: 'icon' in opt ? opt.icon : undefined,
    avatar: 'avatar' in opt ? opt.avatar : undefined,
    onSelect() {
      void router.push(schedulePathForSlug(opt.value))
    }
  }))
])

const headerTitle = computed(() => scheduleNavbarHeading(scope.value))

const navbarAvatar = computed(() => scheduleNavbarAvatar(scope.value))

const viewTabs = [
  { label: 'Список', value: 'list', icon: 'i-lucide-table-properties' },
  { label: 'Доска', value: 'board', icon: 'i-lucide-calendar-fold' }
]

const eventDetailOpen = ref(false)
const eventSlideoverEditable = ref(false)
const eventSlideoverCreateMode = ref(false)
const createDayBlockId = ref('')
const pendingCreateRow = ref<ScheduleRow | null>(null)
const eventSelection = ref<{
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
  initialAttachments: ScheduleAttachmentFile[]
} | null>(null)

const createDayBlocks = computed(() => scheduleBlocks.value)

function resolveCreateTargetBlock(preferredId?: string): ScheduleDateBlock | undefined {
  const blocks = scheduleBlocks.value
  if (!blocks.length)
    return undefined
  if (preferredId) {
    const preferred = blocks.find(b => b.id === preferredId)
    if (preferred)
      return preferred
  }
  return blocks.find(b => b.id === 'day-0') ?? blocks[0]
}

function syncCreateSelection() {
  const slug = substituteSlug.value
  const row = pendingCreateRow.value
  if (!slug || !row)
    return
  const block = resolveCreateTargetBlock(createDayBlockId.value)
  if (!block)
    return
  const group = ensureSubstituteGroup(block, slug)
  createDayBlockId.value = block.id
  const blockDate = parseDateFromScheduleBlockTitle(block.title)
  if (blockDate) {
    row.detail ??= {}
    row.detail.date = blockDate
  }
  eventSelection.value = {
    block,
    group,
    row,
    initialAttachments: row.attachmentFiles.map(f => ({ ...f })),
  }
}

function onCreateEvent(block?: ScheduleDateBlock) {
  if (!canCreateEvents.value || !substituteSlug.value)
    return
  const target = block
    ? resolveCreateTargetBlock(block.id)
    : resolveCreateTargetBlock()
  if (!target) {
    toast.add({
      title: 'Не удалось создать мероприятие',
      description: 'Нет доступного дня в графике.',
      color: 'error'
    })
    return
  }
  const blockDate = parseDateFromScheduleBlockTitle(target.title)
  pendingCreateRow.value = createEmptyScheduleRow(blockDate)
  createDayBlockId.value = target.id
  eventSlideoverCreateMode.value = true
  eventSlideoverEditable.value = true
  syncCreateSelection()
  eventDetailOpen.value = true
}

function openEventDetail(
  block: ScheduleDateBlock,
  group: ScheduleUserGroup,
  row: ScheduleRow,
  editable = false
) {
  eventSlideoverEditable.value = editable
  eventSelection.value = {
    block,
    group,
    row,
    initialAttachments: row.attachmentFiles.map(f => ({ ...f })),
  }
  eventDetailOpen.value = true
}

watch(eventDetailOpen, (isOpen) => {
  if (!isOpen) {
    eventSelection.value = null
    eventSlideoverEditable.value = false
    eventSlideoverCreateMode.value = false
    pendingCreateRow.value = null
    createDayBlockId.value = ''
  }
})

watch(createDayBlockId, () => {
  if (eventSlideoverCreateMode.value && pendingCreateRow.value)
    syncCreateSelection()
})

function onEventSlideoverEdit() {
  eventSlideoverEditable.value = true
}

async function onEventSlideoverSaved() {
  const s = eventSelection.value
  if (!s)
    return

  const wasCreate = eventSlideoverCreateMode.value

  try {
    const saved = await saveEvent(
      s.row,
      s.group,
      s.block,
      wasCreate,
      s.initialAttachments,
    )
    Object.assign(s.row, saved)
    if (wasCreate && !s.group.rows.includes(s.row))
      s.group.rows.push(s.row)

    eventSlideoverCreateMode.value = false
    pendingCreateRow.value = null
    createDayBlockId.value = ''

    await refreshSchedule()
    toast.add({
      title: wasCreate ? 'Мероприятие создано' : 'Изменения сохранены',
      description: saved.topic.trim() || 'Запись в графике обновлена.',
      color: 'success',
    })
  } catch (e) {
    toast.add({
      title: 'Ошибка сохранения',
      description: e instanceof Error ? e.message : 'Не удалось сохранить',
      color: 'error',
    })
  }
}

function onScheduleRowActivate(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  openEventDetail(block, group, row, false)
}

function onBoardCardActivate(card: ScheduleBoardCard) {
  onScheduleRowActivate(card.block, card.group, card.row)
}

function accentSurfaceClass(accent: ScheduleUserGroup['accent']) {
  const map: Record<ScheduleUserGroup['accent'], string> = {
    rose: 'bg-[rgba(251,44,54,0.04)]',
    blue: 'bg-[rgba(43,127,255,0.04)]',
    violet: 'bg-[rgba(124,58,237,0.04)]',
    amber: 'bg-[rgba(217,119,6,0.04)]',
    emerald: 'bg-[rgba(5,150,105,0.04)]'
  }
  return map[accent]
}

const deleteModalOpen = ref(false)
const deletePending = ref<{
  block: ScheduleDateBlock
  group: ScheduleUserGroup
  row: ScheduleRow
} | null>(null)

const deleteModalDescription = computed(() => {
  const p = deletePending.value
  if (!p)
    return 'Это действие нельзя отменить.'
  const t = p.row.topic
  const short = t.length > 120 ? `${t.slice(0, 120)}…` : t
  return `Событие «${short}» будет удалено без возможности восстановления.`
})

function rowContextMenuItems(
  block: ScheduleDateBlock,
  group: ScheduleUserGroup,
  row: ScheduleRow
): DropdownMenuItem[][] {
  if (!canEditGroup(group))
    return []
  return [[
    {
      label: 'Редактировать',
      icon: 'i-lucide-pencil',
      onSelect() {
        onEditEvent(block, group, row)
      }
    },
    {
      label: 'Удалить',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect() {
        onRequestDelete(block, group, row)
      }
    }
  ]]
}

function onEditEvent(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  if (!canEditGroup(group))
    return
  openEventDetail(block, group, row, true)
}

function onRequestDelete(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  deletePending.value = { block, group, row }
  deleteModalOpen.value = true
}

async function confirmDeleteEvent() {
  const p = deletePending.value
  if (!p)
    return
  const { row } = p
  try {
    await deleteEvent(row)
    if (eventSelection.value?.row === row)
      eventDetailOpen.value = false
    await refreshSchedule()
    toast.add({
      title: 'Мероприятие удалено',
      description: row.topic.length > 100 ? `${row.topic.slice(0, 100)}…` : row.topic,
      color: 'success',
    })
  } catch (e) {
    toast.add({
      title: 'Ошибка удаления',
      description: e instanceof Error ? e.message : 'Не удалось удалить',
      color: 'error',
    })
  } finally {
    deleteModalOpen.value = false
    deletePending.value = null
  }
}

function cancelDeleteEvent() {
  deleteModalOpen.value = false
  deletePending.value = null
}
</script>

<template>
  <UDashboardPanel id="substitutes-schedule" :ui="{
    root: 'flex min-h-0 min-w-0 flex-1 flex-col',
    body: 'flex min-h-0 flex-1 flex-col overflow-hidden px-6 sm:px-6 pt-6 sm:pt-6 pb-0 sm:pb-0'
  }">
    <div
      v-if="scheduleLoading"
      class="mb-4 flex flex-1 flex-col items-center justify-center gap-3 py-16"
    >
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
      <p class="text-sm text-muted">
        Загружаем график…
      </p>
    </div>
    <UAlert
      v-else-if="scheduleError"
      color="error"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-circle-alert"
      title="Не удалось загрузить график"
      :description="scheduleError"
    />
    <template #header>
      <UDashboardNavbar :ui="{ right: 'gap-3' }">
        <template #leading>
          <div class="flex min-w-0 items-center gap-1.5">
            <UDashboardSidebarCollapse />
            <UDropdownMenu :items="titleMenuItems" :content="{ align: 'end', collisionPadding: 12 }">
              <UButton color="neutral" variant="ghost" size="xl"
                class="h-auto max-w-full gap-2 px-1.5 font-semibold text-highlighted">
                <UAvatar v-if="navbarAvatar" v-bind="navbarAvatar" size="xs" class="shrink-0" />
                <span class="min-w-0 truncate">{{ headerTitle }}</span>
                <UIcon name="i-lucide-chevron-down" class="size-6 shrink-0 text-dimmed" />
              </UButton>
            </UDropdownMenu>
          </div>
        </template>

        <template #right>
          <UTabs v-model="view" :items="viewTabs" :content="false" size="lg" color="neutral"
            class="w-full max-w-[calc(100vw-12rem)] sm:max-w-md" />
        </template>
      </UDashboardNavbar>
    </template>


    <template #body>
      <div
        v-if="!scheduleLoading && !scheduleError"
        class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch"
      >
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Поиск по теме, месту, времени…"
          class="min-w-0 flex-1"
          size="lg"
        />

        <USelectMenu
          v-model="selectedParticipantKeys"
          :items="participantSelectItems"
          value-key="value"
          multiple
          size="lg"
          :search-input="{ placeholder: 'Найти участника…' }"
          placeholder="Участники"
          icon="i-lucide-users"
          class="w-full sm:w-72"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
        />

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <UButton
            v-if="hasActiveFilters"
            label="Сбросить"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-filter-x"
            @click="resetScheduleFilters"
          />

          <UButton
            v-if="canCreateEvents"
            label="Добавить"
            icon="i-lucide-plus"
            color="primary"
            size="lg"
            class="sm:px-5"
            @click="onCreateEvent()"
          />
        </div>
      </div>

      <div v-if="!scheduleLoading && !scheduleError" class="flex min-h-0 min-w-0 flex-1 flex-col">
        <UEmpty
          v-if="!filteredBlocks.length"
          class="flex-1 py-16"
          icon="i-lucide-calendar-x"
          :title="emptyStateTitle"
          :description="emptyStateDescription"
        >
          <template v-if="emptyStateActions.length" #actions>
            <UButton
              v-for="(action, index) in emptyStateActions"
              :key="index"
              :label="action.label"
              :icon="action.icon"
              :color="action.color"
              :variant="action.variant"
              size="lg"
              @click="action.onClick()"
            />
          </template>
        </UEmpty>

        <div v-else-if="view === 'board'" class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div class="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden px-0.5 pb-2">
            <div v-for="col in boardColumns" :key="col.block.id"
              class="border-default flex w-[min(20rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden rounded-xl border bg-elevated/40 dark:bg-elevated/15">
              <div class="border-default flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
                <UIcon name="i-lucide-grip-vertical" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <template v-if="dayBlockHeadings.has(col.block.id)">
                    <div class="text-sm font-semibold leading-tight text-highlighted tabular-nums">
                      {{ dayBlockHeadings.get(col.block.id)!.dayAndDate }}
                    </div>
                    <div class="text-xs text-muted">
                      {{ dayBlockHeadings.get(col.block.id)!.weekday }}
                    </div>
                  </template>
                  <div v-else class="text-sm font-semibold text-highlighted">
                    {{ col.block.title }}
                  </div>
                </div>
              </div>

              <div class="border-default shrink-0 border-b p-2">
                <UButton
                  v-if="canCreateEvents"
                  block
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-plus"
                  label="Добавить мероприятие"
                  class="justify-center"
                  @click="onCreateEvent(col.block)"
                />
              </div>

              <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                <UEmpty
                  v-if="!col.cards.length"
                  size="sm"
                  variant="naked"
                  icon="i-lucide-calendar-off"
                  title="Нет мероприятий"
                  description="На этот день записей пока нет"
                  class="py-8"
                />
                <template v-for="c in col.cards" :key="c.cardKey">
                  <div :class="[
                    'rounded-lg border border-default bg-default p-3 shadow-sm transition-[box-shadow,transform,background-color]',
                    accentCardTopBorder(c.group.accent),
                    isScheduleGeneralView && accentSurfaceClass(c.group.accent),
                    'cursor-pointer hover:-translate-y-0.5 hover:bg-elevated/30 hover:shadow-md',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  ]" role="button" tabindex="0" @click="onBoardCardActivate(c)"
                    @keydown.enter.prevent="onBoardCardActivate(c)" @keydown.space.prevent="onBoardCardActivate(c)">
                    <div class="mb-2 flex flex-wrap items-start gap-2">
                      <span class="rounded-md bg-elevated px-1.5 py-0.5 text-xs text-muted tabular-nums">
                        {{ boardCardDisplayId(c.cardKey) }}
                      </span>
                      <span
                        class="text-xs text-dimmed"
                        :class="{ 'tabular-nums': !isScheduleRowAllDay(c.row) }"
                      >{{ formatScheduleRowTime(c.row) }}</span>
                      <div class="ms-auto shrink-0" @click.stop>
                        <UDropdownMenu
                          v-if="rowContextMenuItems(c.block, c.group, c.row).length"
                          :items="rowContextMenuItems(c.block, c.group, c.row)"
                          :content="{ align: 'end', collisionPadding: 12 }"
                        >
                          <UButton color="neutral" variant="ghost" square size="xs" icon="i-lucide-ellipsis"
                            aria-label="Действия с мероприятием" />
                        </UDropdownMenu>
                      </div>
                    </div>

                    <div v-if="isScheduleGeneralView" class="mb-2 flex min-w-0 items-center gap-2">
                      <UAvatar :src="c.group.avatarSrc" size="xs" class="shrink-0" />
                      <span class="truncate text-xs font-medium text-default">{{ c.group.name }}</span>
                    </div>

            <ScheduleHiddenEventLabel
              v-if="isScheduleRowViewRestricted(c.row)"
              size="sm"
              class="py-1"
            />
                    <template v-else>
                      <p class="line-clamp-4 text-sm font-medium leading-snug text-highlighted">
                        <span class="inline-flex items-start gap-1.5">
                          <ScheduleHiddenBadge
                            v-if="c.row.hidden"
                            variant="icon"
                            class="mt-0.5"
                          />
                          <span class="min-w-0">{{ c.row.topic }}</span>
                        </span>
                      </p>

                      <p class="mt-1.5 line-clamp-2 text-xs text-muted">
                        {{ formatSchedulePlace(c.row) }}
                      </p>

                      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex min-w-0 items-center">
                          <div class="flex -space-x-1.5">
                            <UAvatar v-for="(p, pi) in c.row.participants.slice(0, 3)" :key="pi" :src="p.avatarSrc"
                              :alt="p.name" size="xs" class="ring-2 ring-bg" />
                          </div>
                          <span v-if="c.row.participants.length > 3"
                            class="ms-1.5 shrink-0 text-xs text-dimmed tabular-nums">
                            +{{ c.row.participants.length - 3 }}
                          </span>
                        </div>
                        <UIcon v-if="c.row.attachmentFiles.length" name="i-lucide-paperclip"
                          class="size-4 shrink-0 text-dimmed" :title="c.row.attachmentsLabel" />
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="min-h-0 min-w-0 flex-1 overflow-auto rounded-t-lg border border-default bg-default">
          <div :class="isScheduleGeneralView ? 'min-w-[1300px]' : 'min-w-[1160px]'">
            <div
              class="sticky top-0 z-20 grid rounded-t-lg border-b border-default bg-default text-sm font-medium text-default"
              :style="{ gridTemplateColumns: scheduleGridTemplate }">
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="rounded-md px-2.5 py-1.5">Время</span>
              </div>
              <div
                v-if="isScheduleGeneralView"
                class="border-default flex h-12 items-center border-r px-1.5 py-3.5"
              >
                <span class="rounded-md px-2.5 py-1.5">Руководитель</span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="rounded-md px-2.5 py-1.5">Место</span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="rounded-md px-2.5 py-1.5">Тема</span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="rounded-md px-2.5 py-1.5">Участники</span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="rounded-md px-2.5 py-1.5">Приложения</span>
              </div>
              <div v-if="!isScheduleGeneralView" class="border-default flex h-12 items-center justify-center px-1"
                aria-hidden="true" />
            </div>

            <UCollapsible v-for="block in filteredBlocks" :key="block.id" :default-open="block.defaultOpen">
              <template #default="{ open }">
                <UButton color="neutral" variant="ghost"
                  class="sticky top-12 z-10 flex w-full items-center justify-start gap-3 rounded-none border-b border-accented bg-default px-4 py-4 text-highlighted hover:bg-elevated">
                  <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-6 text-dimmed" />
                  <span v-if="dayBlockHeadings.has(block.id)"
                    class="inline-flex flex-wrap items-baseline gap-x-1.5 text-base font-semibold text-highlighted">
                    <span class="tabular-nums">{{ dayBlockHeadings.get(block.id)!.dayAndDate }}</span>
                    <span>{{ dayBlockHeadings.get(block.id)!.weekday }}</span>
                  </span>
                  <span v-else class="text-base font-semibold text-highlighted">{{ block.title }}</span>
                  <UBadge
                    v-if="dayEventCount(block)"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    :label="String(dayEventCount(block))"
                    class="ms-auto tabular-nums"
                  />
                </UButton>
              </template>

              <template #content>
                <div class="border-b border-default">
                  <template
                    v-for="(entry, ei) in dayEntries(block)"
                    :key="dayEntryKey(block.id, entry, ei)"
                  >
                    <div :class="[
                      'grid cursor-pointer border-b border-default transition-colors hover:bg-elevated/40',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
                      isScheduleGeneralView && accentSurfaceClass(entry.group.accent),
                    ]" :style="{ gridTemplateColumns: scheduleGridTemplate }" role="button" tabindex="0"
                      @click="onScheduleRowActivate(block, entry.group, entry.row)"
                      @keydown.enter.prevent="onScheduleRowActivate(block, entry.group, entry.row)"
                      @keydown.space.prevent="onScheduleRowActivate(block, entry.group, entry.row)">
                      <div
                        class="flex min-h-[100px] flex-col justify-center border-r border-default p-4 text-sm text-default">
                        <span
                          class="tabular-nums"
                          :class="{ 'text-default': !isScheduleRowAllDay(entry.row) }"
                        >{{ formatScheduleRowTime(entry.row) }}</span>
                      </div>
                      <template v-if="isScheduleRowViewRestricted(entry.row)">
                        <div
                          class="flex min-h-[100px] items-center border-r border-default p-4"
                          :style="{ gridColumn: hiddenEventDetailsGridColumn(isScheduleGeneralView) }"
                        >
                          <ScheduleHiddenEventLabel />
                        </div>
                      </template>
                      <template v-else>
                        <div
                          v-if="isScheduleGeneralView"
                          class="flex min-h-[100px] items-center gap-2 border-r border-default p-4"
                          @click.stop
                        >
                          <UAvatar :src="entry.group.avatarSrc" size="sm" class="shrink-0" />
                          <span class="min-w-0 text-sm font-medium leading-snug text-default">{{ entry.group.name }}</span>
                        </div>
                        <div
                          class="flex min-h-[100px] items-center border-r border-default p-4 text-sm leading-5 text-default"
                        >
                          <span class="min-w-0 whitespace-normal wrap-break-word">{{ formatSchedulePlace(entry.row) }}</span>
                        </div>
                        <div
                          class="flex min-h-[100px] flex-col justify-center gap-1.5 border-r border-default p-4 text-sm leading-5 text-default"
                        >
                          <span class="inline-flex min-w-0 items-start gap-2">
                            <ScheduleHiddenBadge
                              v-if="entry.row.hidden"
                              variant="icon"
                              class="mt-0.5 shrink-0"
                            />
                            <span class="min-w-0 whitespace-normal wrap-break-word">{{ entry.row.topic }}</span>
                          </span>
                        </div>
                        <div
                          class="flex min-h-[100px] flex-wrap content-center items-center gap-3 border-r border-default p-4"
                          @click.stop
                        >
                          <ScheduleParticipantPopoverChip
                            v-for="(participant, pi) in entry.row.participants"
                            :key="pi"
                            variant="table"
                            :participant="participant"
                          />
                        </div>
                        <div
                          class="flex min-h-[100px] min-w-0 items-center justify-end border-r border-default p-4"
                          @click.stop
                        >
                          <ScheduleAttachmentsPopover
                            v-if="entry.row.attachmentFiles.length"
                            :files="entry.row.attachmentFiles"
                            :label="entry.row.attachmentsLabel"
                          />
                        </div>
                      </template>
                      <div v-if="!isScheduleGeneralView"
                        class="flex min-h-[100px] items-center justify-center border-default p-1" @click.stop>
                        <UDropdownMenu
                          v-if="rowContextMenuItems(block, entry.group, entry.row).length"
                          :items="rowContextMenuItems(block, entry.group, entry.row)"
                          :content="{ align: 'end', collisionPadding: 12 }"
                        >
                          <UButton color="neutral" variant="ghost" square size="sm" icon="i-lucide-ellipsis-vertical"
                            aria-label="Действия с мероприятием" />
                        </UDropdownMenu>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </UCollapsible>
          </div>
        </div>
      </div>

      <ScheduleEventSlideover
        v-model:open="eventDetailOpen"
        v-model:create-day-block-id="createDayBlockId"
        :selection="eventSelection"
        :editable="eventSlideoverEditable"
        :is-create="eventSlideoverCreateMode"
        :create-day-blocks="createDayBlocks"
        :available-participants="scheduleParticipants"
        :can-edit="eventSelection ? canEditGroup(eventSelection.group) : false"
        @saved="onEventSlideoverSaved"
        @edit="onEventSlideoverEdit"
      />

      <UModal v-model:open="deleteModalOpen" title="Удалить мероприятие?" :description="deleteModalDescription">
        <template #body>
          <div class="flex justify-end gap-2">
            <UButton label="Отмена" color="neutral" variant="subtle" @click="cancelDeleteEvent" />
            <UButton label="Удалить" color="error" variant="solid" @click="confirmDeleteEvent" />
          </div>
        </template>
      </UModal>
    </template>

  </UDashboardPanel>
</template>
