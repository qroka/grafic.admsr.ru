<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter } from 'vue-router'
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  scheduleNavbarAvatar,
  scheduleNavbarHeading,
  scheduleTitleOptions,
  scheduleAttachmentsColumnWidth,
  scheduleTimeColumnWidth,
} from '../../config/schedule'
import { useParticipants } from '../../composables/useParticipants'
import { useDragScroll } from '../../composables/useDragScroll'
import { useWheelHorizontalScroll } from '../../composables/useWheelHorizontalScroll'
import { usePermissions } from '../../composables/usePermissions'
import { useScheduleApi } from '../../composables/useScheduleApi'
import { fetchEventById } from '../../api/events'
import { buildScheduleEventSelection, buildSchedulePlaceQuickOptionsFromEvents } from '../../api/schedule-mapper'
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
  cloneScheduleRowForCopy,
  filterScheduleBlocks,
  filterScheduleBySubstitute,
  ensureSubstituteGroup,
  formatSchedulePlace,
  formatScheduleRowTime,
  personAvatarChip,
  isScheduleRowAllDay,
  isScheduleRowCancelled,
  isScheduleRowViewRestricted,
  isScheduleRowAttachmentsHiddenForOthers,
  buildScheduleDayBlockHeading,
  findScheduleBlockIdByDate,
  findTodayScheduleBlock,
  parseDateFromScheduleBlockTitle,
  SCHEDULE_FUTURE_DAYS,
  type ScheduleDateBlocksRange,
  parseScheduleSlugFromPath,
  scheduleParticipantKey,
  schedulePathForSlug,
} from '../../utils/schedule'
import ScheduleArchivePopover from './ScheduleArchivePopover.vue'
import ScheduleAttachmentsPopover from './ScheduleAttachmentsPopover.vue'
import ScheduleEventSlideover from './ScheduleEventSlideover.vue'
import ScheduleCancelledBadge from './ScheduleCancelledBadge.vue'
import ScheduleHiddenBadge from './ScheduleHiddenBadge.vue'
import ScheduleHiddenAttachmentsBadge from './ScheduleHiddenAttachmentsBadge.vue'
import ScheduleHiddenEventLabel from './ScheduleHiddenEventLabel.vue'
import ScheduleParticipantPopoverChip from './ScheduleParticipantPopoverChip.vue'
import PersonAvatar from '../PersonAvatar.vue'
import NotificationsToolbarButton from '../notifications/NotificationsToolbarButton.vue'

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
const { loadBlocks, saveEvent, deleteEvent, setEventCancelled, loading: scheduleLoading, error: scheduleError, events: scheduleEvents } = useScheduleApi()
const { participants: crmParticipants, load: loadParticipants } = useParticipants()
const { canEditSchedule, canEditSubstituteSlug } = usePermissions()

const view = useLocalStorage<'list' | 'board'>('grafic.schedule.view', 'list')

const scheduleBlocks = ref<ScheduleDateBlock[]>([])
const scheduleArchiveEnabled = useLocalStorage('grafic.schedule.archive', false)
const scheduleJumpStartDate = ref<string | null>(null)

const scheduleArchiveActive = computed(() =>
  scheduleArchiveEnabled.value || Boolean(scheduleJumpStartDate.value),
)

const scheduleBlocksRange = computed((): ScheduleDateBlocksRange => ({
  pastDays: scheduleArchiveEnabled.value && !scheduleJumpStartDate.value
    ? 1
    : 0,
  futureDays: SCHEDULE_FUTURE_DAYS,
  jumpStartDate: scheduleJumpStartDate.value ?? undefined,
}))

async function refreshSchedule() {
  scheduleBlocks.value = await loadBlocks(scheduleBlocksRange.value)
}

watch(scheduleBlocksRange, () => {
  refreshSchedule()
}, { deep: true })

onMounted(async () => {
  await Promise.all([refreshSchedule(), loadParticipants()])
})

const scope = computed<ScheduleTitleValue>(() => parseScheduleSlugFromPath(route.path))

const schedulePlaceQuickOptions = computed(() =>
  buildSchedulePlaceQuickOptionsFromEvents(scheduleEvents.value, scope.value),
)

const isScheduleGeneralView = computed(() => scope.value === 'general')

const canCreateEvents = computed(() =>
  canEditSchedule(substituteSlug.value),
)

const showScheduleRowActions = computed(() =>
  !isScheduleGeneralView.value && canCreateEvents.value,
)

function canEditGroup(group: ScheduleUserGroup): boolean {
  return !isScheduleGeneralView.value && canEditSubstituteSlug(group.substituteKey)
}

const substituteSlug = computed(() =>
  isScheduleGeneralView.value ? null : scope.value as ScheduleSubstituteSlug)

const scheduleGridTemplate = computed(() => {
  if (isScheduleGeneralView.value)
    return `${scheduleTimeColumnWidth} 200px 256px 1fr 1fr ${scheduleAttachmentsColumnWidth}`
  const base = `${scheduleTimeColumnWidth} 256px 1fr 1fr ${scheduleAttachmentsColumnWidth}`
  return showScheduleRowActions.value ? `${base} 52px` : base
})

const hiddenEventDetailsGridColumn = computed(() => {
  if (isScheduleGeneralView.value)
    return '3 / 7'
  return showScheduleRowActions.value ? '2 / 6' : '2 / 5'
})

const scheduleListMinWidth = computed(() => {
  if (isScheduleGeneralView.value)
    return '1335px'
  return showScheduleRowActions.value ? '1195px' : '1143px'
})

const visibleBlocks = computed(() =>
  filterScheduleBySubstitute(scheduleBlocks.value, scope.value))

const searchQuery = ref('')
const selectedParticipantKeys = ref<string[]>([])

const scheduleParticipants = computed(() => crmParticipants.value)

const participantSelectItems = computed(() =>
  scheduleParticipants.value.map((p: ScheduleParticipant) => ({
    label: p.name,
    value: scheduleParticipantKey(p),
    avatar: personAvatarChip(p.name)
  })))

const filteredBlocks = computed(() =>
  filterScheduleBlocks(
    visibleBlocks.value,
    searchQuery.value,
    selectedParticipantKeys.value
  ))

interface ScheduleListSection {
  key: string
  label?: string
  blocks: ScheduleDateBlock[]
}

const scheduleListSections = computed((): ScheduleListSection[] => {
  if (scheduleArchiveActive.value) {
    return [{
      key: 'archive',
      label: 'Архив',
      blocks: filteredBlocks.value,
    }]
  }

  return [{ key: 'primary', blocks: filteredBlocks.value }]
})

const boardSourceBlocks = computed(() => {
  if (scheduleArchiveActive.value)
    return filteredBlocks.value
  return filteredBlocks.value.filter(b => !b.isArchive)
})

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
  boardSourceBlocks.value.map(block => ({
    block,
    cards: dayEntries(block).map((entry, index) => ({
      block,
      group: entry.group,
      row: entry.row,
      cardKey: dayEntryKey(block.id, entry, index)
    }))
  }))
)

function accentSurfaceClass(accent: ScheduleUserGroup['accent']) {
  const map: Record<ScheduleUserGroup['accent'], string> = {
    rose: 'bg-[rgba(251,44,54,0.04)]',
    blue: 'bg-[rgba(43,127,255,0.04)]',
    violet: 'bg-[rgba(124,58,237,0.04)]',
    amber: 'bg-[rgba(217,119,6,0.04)]',
    emerald: 'bg-[rgba(5,150,105,0.04)]',
  }
  return map[accent]
}

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

useHead({
  title: headerTitle,
})

const navbarAvatar = computed(() => scheduleNavbarAvatar(scope.value))

const viewTabs = [
  { label: 'Список', value: 'list', icon: 'i-lucide-table-properties' },
  { label: 'Доска', value: 'board', icon: 'i-lucide-calendar-fold' }
]

const boardScrollRef = ref<HTMLElement | null>(null)
const {
  isDragging: isBoardScrollDragging,
  suppressClick: suppressBoardClick,
  onMouseDown: onBoardScrollMouseDown,
} = useDragScroll(boardScrollRef)
useWheelHorizontalScroll(boardScrollRef)

const eventDetailOpen = ref(false)
const eventSlideoverEditable = ref(false)
const eventSlideoverCreateMode = ref(false)
const eventSlideoverCopyMode = ref(false)
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
  return blocks.find(b => b.id === createDayBlockId.value)
    ?? findTodayScheduleBlock(blocks)
    ?? blocks[0]
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
  eventSlideoverCopyMode.value = false
  eventSlideoverEditable.value = true
  syncCreateSelection()
  eventDetailOpen.value = true
}

function onCopyEvent(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  if (!canEditGroup(group))
    return
  if (isScheduleRowViewRestricted(row)) {
    toast.add({
      title: 'Нельзя скопировать',
      description: 'Недостаточно данных о мероприятии.',
      color: 'warning',
    })
    return
  }

  const copyRow = cloneScheduleRowForCopy(row)
  const copyDate = copyRow.detail?.date?.trim()
  let targetBlock = block
  if (copyDate) {
    const blockId = findScheduleBlockIdByDate(scheduleBlocks.value, copyDate)
    if (blockId) {
      const resolved = scheduleBlocks.value.find(b => b.id === blockId)
      if (resolved)
        targetBlock = resolved
    }
  }

  pendingCreateRow.value = copyRow
  createDayBlockId.value = targetBlock.id
  eventSlideoverCreateMode.value = true
  eventSlideoverCopyMode.value = true
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
  eventSlideoverCreateMode.value = false
  eventSlideoverCopyMode.value = false
  eventSelection.value = {
    block,
    group,
    row,
    initialAttachments: row.attachmentFiles.map(f => ({ ...f })),
  }
  eventDetailOpen.value = true
}

async function openEventFromNotification(eventId: number) {
  try {
    const event = await fetchEventById(eventId)
    const selection = buildScheduleEventSelection(event)
    if (!selection) {
      throw new Error('Не удалось открыть мероприятие')
    }

    if (selection.group.substituteKey !== substituteSlug.value) {
      await router.push(schedulePathForSlug(selection.group.substituteKey))
    }

  eventSlideoverCreateMode.value = false
  eventSlideoverCopyMode.value = false
  eventSlideoverEditable.value = false
  eventSelection.value = {
      ...selection,
      initialAttachments: selection.row.attachmentFiles.map(f => ({ ...f })),
    }
    eventDetailOpen.value = true
  } catch (e) {
    toast.add({
      title: 'Не удалось открыть мероприятие',
      description: e instanceof Error ? e.message : 'Попробуйте позже',
      color: 'error',
    })
  }
}

watch(eventDetailOpen, (isOpen) => {
  if (!isOpen) {
    eventSelection.value = null
    eventSlideoverEditable.value = false
    eventSlideoverCreateMode.value = false
    eventSlideoverCopyMode.value = false
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

function onEventSlideoverCopy() {
  const s = eventSelection.value
  if (!s)
    return
  onCopyEvent(s.block, s.group, s.row)
}

async function onEventSlideoverSaved() {
  const s = eventSelection.value
  if (!s)
    return

  const wasCreate = eventSlideoverCreateMode.value
  const wasCopy = eventSlideoverCopyMode.value

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
    eventSlideoverCopyMode.value = false
    pendingCreateRow.value = null
    createDayBlockId.value = ''

    await refreshSchedule()
    toast.add({
      title: wasCreate
        ? (wasCopy ? 'Мероприятие скопировано' : 'Мероприятие создано')
        : 'Изменения сохранены',
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
  if (suppressBoardClick.value)
    return
  onScheduleRowActivate(card.block, card.group, card.row)
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

  const items: DropdownMenuItem[] = [
    {
      label: 'Редактировать',
      icon: 'i-lucide-pencil',
      onSelect() {
        onEditEvent(block, group, row)
      }
    },
    {
      label: 'Копировать',
      icon: 'i-lucide-copy',
      onSelect() {
        onCopyEvent(block, group, row)
      }
    },
  ]

  if (isScheduleRowCancelled(row)) {
    items.push({
      label: 'Восстановить мероприятие',
      icon: 'i-lucide-calendar-check',
      onSelect() {
        onRestoreEvent(block, group, row)
      }
    })
  }
  else {
    items.push({
      label: 'Отменить мероприятие',
      icon: 'i-lucide-calendar-x',
      onSelect() {
        onCancelEvent(block, group, row)
      }
    })
  }

  items.push({
    label: 'Удалить',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect() {
      onRequestDelete(block, group, row)
    }
  })

  return [items]
}

function onEditEvent(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  if (!canEditGroup(group))
    return
  eventSlideoverCopyMode.value = false
  openEventDetail(block, group, row, true)
}

function onRequestDelete(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  deletePending.value = { block, group, row }
  deleteModalOpen.value = true
}

async function onCancelEvent(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  if (!canEditGroup(group) || !row.apiId || isScheduleRowCancelled(row))
    return
  try {
    const saved = await setEventCancelled(row, true)
    Object.assign(row, saved)
    if (eventSelection.value?.row === row)
      eventSelection.value = { block, group, row }
    await refreshSchedule()
    toast.add({
      title: 'Мероприятие отменено',
      color: 'success',
    })
  } catch (e) {
    toast.add({
      title: 'Не удалось отменить мероприятие',
      description: e instanceof Error ? e.message : undefined,
      color: 'error',
    })
  }
}

async function onRestoreEvent(block: ScheduleDateBlock, group: ScheduleUserGroup, row: ScheduleRow) {
  if (!canEditGroup(group) || !row.apiId || !isScheduleRowCancelled(row))
    return
  try {
    const saved = await setEventCancelled(row, false)
    Object.assign(row, saved)
    if (eventSelection.value?.row === row)
      eventSelection.value = { block, group, row }
    await refreshSchedule()
    toast.add({
      title: 'Мероприятие восстановлено',
      color: 'success',
    })
  } catch (e) {
    toast.add({
      title: 'Не удалось восстановить мероприятие',
      description: e instanceof Error ? e.message : undefined,
      color: 'error',
    })
  }
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
          <NotificationsToolbarButton @open-event="openEventFromNotification" />
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

          <ScheduleArchivePopover
            v-model:archive-enabled="scheduleArchiveEnabled"
            v-model:jump-start-date="scheduleJumpStartDate"
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
          <div
            ref="boardScrollRef"
            class="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden p-px pb-2 sm:gap-4"
            :class="isBoardScrollDragging ? 'cursor-grabbing select-none' : 'cursor-grab'"
            @mousedown="onBoardScrollMouseDown"
          >
            <div
              v-for="col in boardColumns"
              :key="col.block.id"
              class="flex min-h-0 w-[min(19rem,calc(100vw-2.5rem))] shrink-0 flex-col overflow-hidden rounded-lg border border-default bg-elevated/50 dark:bg-elevated/20"
            >
              <div class="flex shrink-0 items-center gap-3 border-b border-default px-3.5 py-3 sm:px-4">
                <div
                  class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15"
                >
                  <UIcon name="i-lucide-calendar-days" class="size-4" aria-hidden="true" />
                </div>
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
                <UBadge
                  v-if="col.cards.length"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="shrink-0 tabular-nums"
                  :label="String(col.cards.length)"
                />
              </div>

              <div v-if="canCreateEvents" class="shrink-0 px-3 pt-3 mb-3 sm:px-3.5">
                <UButton
                  block
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-plus"
                  label="Добавить"
                  class="justify-center"
                  @click="onCreateEvent(col.block)"
                />
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto overscroll-y-contain overscroll-x-none">
                <UEmpty
                  v-if="!col.cards.length"
                  size="sm"
                  variant="naked"
                  icon="i-lucide-calendar-off"
                  title="Нет мероприятий"
                  description="На этот день записей пока нет"
                  class="py-10"
                />
                <template v-for="c in col.cards" :key="c.cardKey">
                  <div
                    :class="[
                      'group border-t border-default p-3.5 py-2',
                      accentSurfaceClass(c.group.accent),
                      'cursor-pointer hover:-translate-y-px hover:border-primary/20 hover:bg-elevated/40 hover:shadow-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    ]"
                    role="button"
                    tabindex="0"
                    @click="onBoardCardActivate(c)"
                    @keydown.enter.prevent="onBoardCardActivate(c)"
                    @keydown.space.prevent="onBoardCardActivate(c)"
                  >
                    <div class="mb-2.5 flex items-start gap-2">
                      <UBadge
                        v-if="isScheduleRowAllDay(c.row)"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-sun"
                        label="Весь день"
                        class="shrink-0"
                      />
                      <UBadge
                        v-else
                        color="primary"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-clock"
                        :label="formatScheduleRowTime(c.row)"
                        class="shrink-0 tabular-nums"
                      />
                      <div
                        v-if="showScheduleRowActions"
                        class="ms-auto shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                        @click.stop
                      >
                        <UDropdownMenu
                          v-if="rowContextMenuItems(c.block, c.group, c.row).length"
                          :items="rowContextMenuItems(c.block, c.group, c.row)"
                          :content="{ align: 'end', collisionPadding: 12 }"
                        >
                          <UButton
                            color="neutral"
                            variant="ghost"
                            square
                            size="xs"
                            icon="i-lucide-ellipsis"
                            aria-label="Действия с мероприятием"
                          />
                        </UDropdownMenu>
                      </div>
                    </div>

                    <div
                      v-if="isScheduleGeneralView"
                      class="mb-2.5 flex min-w-0 items-center gap-2"
                    >
                      <UAvatar :src="c.group.avatarSrc" size="2xs" class="shrink-0" />
                      <span class="truncate text-xs font-medium text-default">{{ c.group.name }}</span>
                    </div>

                    <ScheduleHiddenEventLabel
                      v-if="isScheduleRowViewRestricted(c.row)"
                      size="sm"
                    />
                    <template v-else>
                      <p class="line-clamp-3 text-sm font-semibold leading-snug text-highlighted">
                        <span class="inline-flex items-start gap-1.5">
                          <ScheduleHiddenBadge
                            v-if="c.row.hidden"
                            variant="icon"
                            class="mt-0.5"
                          />
                          <span class="min-w-0">{{ c.row.topic }}</span>
                        </span>
                      </p>

                      <div
                        v-if="isScheduleRowCancelled(c.row) || formatSchedulePlace(c.row)"
                        class="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted"
                      >
                        <ScheduleCancelledBadge
                          v-if="isScheduleRowCancelled(c.row)"
                          variant="board"
                        />
                        <template v-else>
                          <UIcon name="i-lucide-map-pin" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span class="line-clamp-2 min-w-0">{{ formatSchedulePlace(c.row) }}</span>
                        </template>
                      </div>

                      <div
                        v-if="c.row.participants.length || c.row.attachmentFiles.length"
                        class="mt-3 flex items-center justify-between gap-2 border-t border-default/80 pt-2.5"
                      >
                        <div v-if="c.row.participants.length" class="flex min-w-0 flex-wrap items-center gap-1">
                          <PersonAvatar
                            v-for="(p, pi) in c.row.participants.slice(0, 4)"
                            :key="pi"
                            :name="p.name"
                            size="2xs"
                            :title="p.name"
                          />
                          <span
                            v-if="c.row.participants.length > 4"
                            class="shrink-0 text-xs text-dimmed tabular-nums"
                          >
                            +{{ c.row.participants.length - 4 }}
                          </span>
                        </div>
                        <span
                          v-if="c.row.attachmentFiles.length"
                          class="inline-flex shrink-0 items-center gap-1 text-xs text-dimmed"
                          :title="c.row.attachmentsLabel"
                        >
                          <ScheduleHiddenAttachmentsBadge
                            v-if="isScheduleRowAttachmentsHiddenForOthers(c.row)"
                            variant="icon"
                          />
                          <UIcon
                            v-else
                            name="i-lucide-paperclip"
                            class="size-3.5"
                            aria-hidden="true"
                          />
                          <span class="tabular-nums">{{ c.row.attachmentFiles.length }}</span>
                        </span>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="min-h-0 min-w-0 flex-1 overflow-auto rounded-t-lg border border-default bg-default">
          <div :style="{ minWidth: scheduleListMinWidth }">
            <div
              class="sticky top-0 z-20 grid rounded-t-lg border-b border-default bg-default text-sm font-medium text-default"
              :style="{ gridTemplateColumns: scheduleGridTemplate }">
              <div class="border-default flex h-12 items-center justify-center border-r px-1.5 py-3.5">
                <span class="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <UIcon name="i-lucide-clock" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Время
                </span>
              </div>
              <div
                v-if="isScheduleGeneralView"
                class="border-default flex h-12 items-center border-r px-1.5 py-3.5"
              >
                <span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <UIcon name="i-lucide-user-round" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Руководитель
                </span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <UIcon name="i-lucide-map-pin" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Место
                </span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <UIcon name="i-lucide-text" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Тема
                </span>
              </div>
              <div class="border-default flex h-12 items-center border-r px-1.5 py-3.5">
                <span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5">
                  <UIcon name="i-lucide-users" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Участники
                </span>
              </div>
              <div class="border-default flex h-12 items-center justify-center border-r px-1.5 py-3.5">
                <span class="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-center">
                  <UIcon name="i-lucide-paperclip" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
                  Приложения
                </span>
              </div>
              <div
                v-if="showScheduleRowActions"
                class="border-default flex h-12 items-center justify-center px-1"
                aria-hidden="true"
              />
            </div>

            <template
              v-for="section in scheduleListSections"
              :key="section.key"
            >
              <div
                v-if="section.label"
                class="sticky top-12 z-10 flex items-center gap-2 border-b border-default bg-elevated/80 px-4 py-3 backdrop-blur-sm"
              >
                <UIcon name="i-lucide-archive" class="size-4 text-muted" aria-hidden="true" />
                <span class="text-sm font-semibold text-highlighted">{{ section.label }}</span>
                <span class="text-xs text-muted">прошлые дни</span>
              </div>

              <UCollapsible
                v-for="block in section.blocks"
                :key="block.id"
                :default-open="block.defaultOpen"
              >
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
                    size="md"
                    :label="String(dayEventCount(block))"
                    class="ms-auto justify-center font-semibold tabular-nums"
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
                      isScheduleRowCancelled(entry.row) && 'bg-elevated/20 opacity-80',
                    ]" :style="{ gridTemplateColumns: scheduleGridTemplate }" role="button" tabindex="0"
                      @click="onScheduleRowActivate(block, entry.group, entry.row)"
                      @keydown.enter.prevent="onScheduleRowActivate(block, entry.group, entry.row)"
                      @keydown.space.prevent="onScheduleRowActivate(block, entry.group, entry.row)">
                      <div
                        class="flex min-h-[100px] flex-col items-center justify-center border-r border-default p-3 text-center text-sm text-default"
                      >
                        <span
                          class="tabular-nums"
                          :class="{ 'text-default': !isScheduleRowAllDay(entry.row) }"
                        >{{ formatScheduleRowTime(entry.row) }}</span>
                      </div>
                      <template v-if="isScheduleRowViewRestricted(entry.row)">
                        <div
                          v-if="isScheduleGeneralView"
                          class="flex min-h-[100px] items-center gap-2 border-r border-default p-4"
                          @click.stop
                        >
                          <UAvatar :src="entry.group.avatarSrc" size="sm" class="shrink-0" />
                          <span class="min-w-0 text-sm font-medium leading-snug text-default">{{ entry.group.name }}</span>
                        </div>
                        <div
                          class="flex min-h-[100px] items-center border-r border-default p-4"
                          :style="{ gridColumn: hiddenEventDetailsGridColumn }"
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
                          class="flex min-h-[100px] flex-col justify-center gap-1.5 border-r border-default p-4 text-sm leading-5 text-default"
                        >
                          <ScheduleCancelledBadge
                            v-if="isScheduleRowCancelled(entry.row)"
                            variant="table"
                          />
                          <span
                            v-if="formatSchedulePlace(entry.row)"
                            class="min-w-0 whitespace-normal wrap-break-word"
                          >{{ formatSchedulePlace(entry.row) }}</span>
                        </div>
                        <div
                          class="flex min-h-[100px] flex-col items-start justify-center gap-2 border-r border-default p-4 text-sm leading-5 text-default"
                        >
                          <ScheduleHiddenBadge
                            v-if="entry.row.hidden && !isScheduleRowViewRestricted(entry.row)"
                            variant="table"
                          />
                          <span class="min-w-0 whitespace-normal wrap-break-word">{{ entry.row.topic }}</span>
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
                          class="flex min-h-[100px] flex-col items-center justify-center gap-2 border-r border-default px-1.5 py-4"
                          @click.stop
                        >
                          <ScheduleHiddenAttachmentsBadge
                            v-if="isScheduleRowAttachmentsHiddenForOthers(entry.row)"
                            variant="table"
                          />
                          <ScheduleAttachmentsPopover
                            v-if="entry.row.attachmentFiles.length"
                            variant="table"
                            :files="entry.row.attachmentFiles"
                            :label="entry.row.attachmentsLabel"
                            :row="entry.row"
                          />
                        </div>
                      </template>
                      <div
                        v-if="showScheduleRowActions"
                        class="flex min-h-[100px] items-center justify-center border-default p-1"
                        @click.stop
                      >
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
            </template>
          </div>
        </div>
      </div>

      <ScheduleEventSlideover
        v-model:open="eventDetailOpen"
        v-model:create-day-block-id="createDayBlockId"
        :selection="eventSelection"
        :editable="eventSlideoverEditable"
        :is-create="eventSlideoverCreateMode"
        :is-copy="eventSlideoverCopyMode"
        :create-day-blocks="createDayBlocks"
        :available-participants="scheduleParticipants"
        :place-quick-options="schedulePlaceQuickOptions"
        :can-edit="eventSelection ? canEditGroup(eventSelection.group) : false"
        @saved="onEventSlideoverSaved"
        @edit="onEventSlideoverEdit"
        @copy="onEventSlideoverCopy"
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
