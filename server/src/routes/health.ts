import type { FastifyPluginAsync } from 'fastify'
import { getDbHealth } from '../services/db.js'

export const healthRoutes: FastifyPluginAsync = async app => {
  app.get('/health', async () => ({
    ok: true,
    service: 'crm-api',
    timestamp: new Date().toISOString(),
  }))

  app.get(
    '/health/detailed',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async () => {
      const db = getDbHealth(app.config.env.SQLITE_PATH)
      return {
        ok: db.status === 'connected',
        service: 'crm-api',
        timestamp: new Date().toISOString(),
        db,
        crm: {
          mock: app.config.env.CRM_MOCK,
          baseUrl: app.config.env.CRM_BASE_URL,
        },
      }
    },
  )
}
