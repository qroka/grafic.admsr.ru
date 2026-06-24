import type { Env } from '../config/env.js'
import type { LocalUser } from '../types/auth.js'
import { collectEmailAddresses } from '../utils/parse-emails.js'
import { CrmParticipantsService } from './crm-participants.js'
import { CrmUsersService } from './crm-users.js'

/** Адреса получателя: локальная БД + u_email/u_notes из CRM (как calendar2_email). */
export async function resolveNotificationEmails(
  env: Env,
  user: LocalUser,
): Promise<string[]> {
  const sources: Array<string | null | undefined> = [user.email]

  if (user.externalUserId) {
    try {
      const crmUser = await new CrmUsersService(env).getById(user.externalUserId, false)
      if (crmUser) {
        sources.push(crmUser.email, crmUser.notes)
      }
    } catch {
      // HTTP-режим или недоступный MySQL — пробуем участников CRM
    }

    if (!collectEmailAddresses(sources).length) {
      try {
        const participant = await new CrmParticipantsService(env).getById(user.externalUserId)
        if (participant?.email)
          sources.push(participant.email)
      } catch {
        // нет адреса в CRM
      }
    }
  }

  return collectEmailAddresses(sources)
}
