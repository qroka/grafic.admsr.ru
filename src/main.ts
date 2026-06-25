import './assets/css/main.css'

import { createApp } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { setupLayouts } from 'virtual:generated-layouts'
import { createHead } from '@unhead/vue/client'
import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import { clearLegacyAuthToken, setUnauthorizedHandler } from './api/client'
import { useAuth } from './composables/useAuth'
import { consumeSsoTokenFromUrl, stripSsoFromUrl } from './utils/crm-sso'

const app = createApp(App)

clearLegacyAuthToken()

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

setUnauthorizedHandler(() => {
  const { clearSession } = useAuth()
  clearSession()
  if (router.currentRoute.value.path !== '/login') {
    void router.replace({
      path: '/login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

router.beforeEach(async (to) => {
  await ssoBootstrap

  const isPublic = Boolean(to.meta.public)
  const { fetchMe, ready, user, canViewLogs } = useAuth()

  if (!ready.value)
    await fetchMe()

  const authenticated = Boolean(user.value)

  if (!authenticated && !isPublic)
    return { path: '/login', query: { redirect: to.fullPath } }

  if (authenticated && to.path === '/login')
    return { path: '/' }

  if (authenticated && !isPublic) {
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
