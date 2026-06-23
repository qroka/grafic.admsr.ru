import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  THEME_COLOR_MODES,
  THEME_NEUTRAL_COLORS,
  THEME_PRIMARY_COLORS,
} from '../constants/theme-colors.js'
import {
  getUserThemePreferences,
  updateUserThemePreferences,
} from '../repositories/user-theme.js'
import { syncUserFromDb } from '../utils/auth-user.js'

const themeBodySchema = z.object({
  primary: z.enum(THEME_PRIMARY_COLORS),
  neutral: z.enum(THEME_NEUTRAL_COLORS),
  colorMode: z.enum(THEME_COLOR_MODES),
})

export const userThemeRoutes: FastifyPluginAsync = async app => {
  app.get(
    '/user/theme',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = syncUserFromDb(request)
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const theme = getUserThemePreferences(user.userId)
      return { success: true, theme }
    },
  )

  app.put(
    '/user/theme',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = syncUserFromDb(request)
      if (!user) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const parsed = themeBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        })
      }

      const theme = updateUserThemePreferences(user.userId, parsed.data)
      return { success: true, theme }
    },
  )
}
