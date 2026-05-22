import './assets/css/main.css'

import { createApp } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { setupLayouts } from 'virtual:generated-layouts'
import { createHead } from '@unhead/vue/client'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { getAuthToken } from './api/client'
import { useAuth } from './composables/useAuth'

const app = createApp(App)

const head = createHead()
const router = createRouter({
  routes: setupLayouts(routes as RouteRecordRaw[]),
  history: createWebHistory(),
})

router.beforeEach(async (to) => {
  const isPublic = Boolean(to.meta.public)
  const token = getAuthToken()

  if (!token && !isPublic)
    return { path: '/login', query: { redirect: to.fullPath } }

  if (token && to.path === '/login')
    return { path: '/schedule' }

  if (token && !isPublic) {
    const { fetchMe, ready, canViewLogs } = useAuth()
    if (!ready.value)
      await fetchMe()
    if (!getAuthToken())
      return { path: '/login', query: { redirect: to.fullPath } }

    if (to.meta.requiresAdmin && !canViewLogs.value)
      return { path: '/schedule' }
  }
})

app.use(head)
app.use(router)
app.use(ui)

app.mount('#app')

// This will update routes at runtime without reloading the page
if (import.meta.hot) {
  handleHotUpdate(router)
}
