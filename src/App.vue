<script setup lang="ts">
import { ref, watchEffect, nextTick } from 'vue'
import { useHead } from '@unhead/vue'
import { useColorMode } from '@vueuse/core'
import { ru } from '@nuxt/ui/locale'
import { useDynamicFavicon } from './composables/useDynamicFavicon'
import { useThemePreferences } from './composables/useThemePreferences'

const colorMode = useColorMode()
useDynamicFavicon()
useThemePreferences()

/** Совпадает с `bg-default` у `body` (Nuxt UI), для `<meta name="theme-color">`. */
const themeColor = ref('#ffffff')

watchEffect(async () => {
  void colorMode.value
  await nextTick()
  if (typeof document === 'undefined')
    return
  const bg = getComputedStyle(document.body).backgroundColor
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')
    themeColor.value = bg
})

useHead(() => ({
  title: 'График',
  htmlAttrs: { lang: 'ru' },
  meta: [
    { name: 'theme-color', content: themeColor.value }
  ]
}))
</script>

<template>
  <Suspense>
    <UApp :locale="ru" class="min-h-dvh bg-default">
      <RouterView />
    </UApp>
  </Suspense>
</template>
