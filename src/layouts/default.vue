<script setup lang="ts">
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
    label: 'График заместителей',
    icon: 'i-lucide-calendar-range',
    to: '/schedule',
    defaultOpen: true,
    type: 'trigger',
    children: scheduleNavChildren,
  }]

  const bottom: NavigationMenuItem[] = []

  if (canViewLogs.value) {
    bottom.push({
      label: 'Пользователи',
      icon: 'i-lucide-users',
      to: '/customers',
      onSelect: () => {
        open.value = false
      },
    })
    bottom.push({
      label: 'Журнал',
      icon: 'i-lucide-scroll-text',
      to: '/logs',
      onSelect: () => {
        open.value = false
      },
    })
  }

  bottom.push({
    label: 'Обратная связь',
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
