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
import { consumeSsoTokenFromUrl, stripSsoFromUrl } from './utils/crm-sso'

const app = createApp(App)

let ssoBootstrap: Promise<void> = Promise.resolve()
const ssoToken = consumeSsoTokenFromUrl()
if (ssoToken) {
  const { loginWithCrmSso } = useAuth()
  ssoBootstrap = loginWithCrmSso(ssoToken)
    .then(() => stripSsoFromUrl())
    .catch(() => {
      stripSsoFromUrl()
    })
}

const head = createHead()
const router = createRouter({
  routes: setupLayouts(routes as RouteRecordRaw[]),
  history: createWebHistory(import.meta.env.BASE_URL),
})

router.beforeEach(async (to) => {
  await ssoBootstrap

  const isPublic = Boolean(to.meta.public)
  const token = getAuthToken()

  if (!token && !isPublic)
    return { path: '/login', query: { redirect: to.fullPath } }

  if (token && to.path === '/login')
    return { path: '/' }

  if (token && !isPublic) {
    const { fetchMe, ready, canViewLogs } = useAuth()
    if (!ready.value)
      await fetchMe()
    if (!getAuthToken())
      return { path: '/login', query: { redirect: to.fullPath } }

    const isLogsRoute = to.path === '/logs' || to.path === '/logs/'
    if ((to.meta.requiresAdmin || isLogsRoute) && !canViewLogs.value)
      return { path: '/' }

    if (to.path === '/customers')
      return { path: '/' }
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
