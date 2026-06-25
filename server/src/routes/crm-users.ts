import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CRM_PERMISSION_MODULES } from '../constants/crm-user-fields.js'
import { CrmDbWriteDisabledError } from '../services/crm-db-policy.js'
import { CrmUsersService } from '../services/crm-users.js'
import { logRouteError } from '../utils/route-errors.js'

const permissionSchema = z.object({
  headOrders: z.number().int().min(0).max(2).optional(),
  headCalendar: z.number().int().min(0).max(2).optional(),
  eventsSchedule: z.number().int().min(0).max(2).optional(),
  deputyOrders: z.number().int().min(0).max(2).optional(),
  controlDocs: z.number().int().min(0).max(2).optional(),
  dumaChairSchedule: z.number().int().min(0).max(2).optional(),
  kspOrders: z.number().int().min(0).max(2).optional(),
  kspSchedule: z.number().int().min(0).max(2).optional(),
})

const listQuerySchema = z.object({
  q: z.string().optional(),
})

const updateSchema = z.object({
  active: z.boolean().optional(),
  login: z.string().min(1).max(255).optional(),
  password: z.string().max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  office: z.string().max(64).optional(),
  position: z.string().max(255).optional(),
  info: z.string().max(255).optional(),
  notes: z.string().max(4000).optional(),
  scheduleRole: z.number().int().min(0).max(4).optional(),
  isDeputy: z.boolean().optional(),
  deputyId: z.number().int().min(0).optional(),
  permissions: permissionSchema.optional(),
})

const createSchema = z.object({
  active: z.boolean(),
  login: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  email: z.string().max(2000).optional(),
  phone: z.string().max(64).optional(),
  office: z.string().max(64).optional(),
  position: z.string().max(255).optional(),
  info: z.string().max(255).optional(),
  notes: z.string().max(4000).optional(),
  scheduleRole: z.number().int().min(0).max(4).optional(),
  isDeputy: z.boolean().optional(),
  deputyId: z.number().int().min(0).optional(),
  permissions: permissionSchema.optional(),
})

export const crmUsersRoutes: FastifyPluginAsync = async app => {
  const crmUsers = new CrmUsersService(app.config.env)

  app.get(
    '/crm-users/meta',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async () => {
      const deputies = await crmUsers.listDeputies()
      return {
        success: true,
        meta: crmUsers.getMeta(),
        deputies,
        scheduleModule: {
          key: 'scheduleRole',
          column: 'u_prem9',
          label: 'График заместителей',
        },
        scheduleRoleLevels: crmUsers.getMeta().scheduleRoleLevels,
        permissionColumns: CRM_PERMISSION_MODULES.map(m => ({
          key: m.key,
          column: m.column,
          label: m.label,
        })),
      }
    },
  )

  app.get(
    '/crm-users',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: 'Invalid query' })
      }

      try {
        const users = await crmUsers.list(parsed.data.q)
        return { success: true, users }
      } catch (error) {
        logRouteError(request.log, error, 'crm-users list failed')
        return reply.status(502).send({ success: false, error: 'Failed to list users' })
      }
    },
  )

  app.get(
    '/crm-users/:id',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id)
      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ success: false, error: 'Invalid id' })
      }

      try {
        const user = await crmUsers.getById(id, true)
        if (!user) {
          return reply.status(404).send({ success: false, error: 'User not found' })
        }
        return { success: true, user }
      } catch (error) {
        logRouteError(request.log, error, 'crm-users get failed')
        return reply.status(502).send({ success: false, error: 'Failed to load user' })
      }
    },
  )

  app.post(
    '/crm-users',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid body',
        })
      }

      try {
        const user = await crmUsers.create(parsed.data)
        return reply.status(201).send({ success: true, user })
      } catch (error) {
        if (error instanceof CrmDbWriteDisabledError) {
          return reply.status(403).send({ success: false, error: error.message })
        }
        logRouteError(request.log, error, 'crm-users create failed')
        return reply.status(502).send({ success: false, error: 'Failed to create user' })
      }
    },
  )

  app.patch(
    '/crm-users/:id',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id)
      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ success: false, error: 'Invalid id' })
      }

      const parsed = updateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid body',
        })
      }

      try {
        const user = await crmUsers.update(id, parsed.data)
        if (!user) {
          return reply.status(404).send({ success: false, error: 'User not found' })
        }
        return { success: true, user }
      } catch (error) {
        if (error instanceof CrmDbWriteDisabledError) {
          return reply.status(403).send({ success: false, error: error.message })
        }
        logRouteError(request.log, error, 'crm-users update failed')
        return reply.status(502).send({ success: false, error: 'Failed to update user' })
      }
    },
  )
}
