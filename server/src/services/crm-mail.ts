import type { FastifyBaseLogger } from 'fastify'
import type { Env } from '../config/env.js'

export async function sendMailViaCrm(
  env: Env,
  to: string,
  subject: string,
  text: string,
  options?: { from?: string, replyTo?: string },
  logger?: Pick<FastifyBaseLogger, 'warn' | 'info'>,
): Promise<boolean> {
  const url = new URL(env.CRM_MAIL_PATH, env.CRM_BASE_URL)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.CRM_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        Host: env.CRM_HOST_HEADER,
        'X-Sync-Secret': env.CRM_SYNC_SECRET,
      },
      body: JSON.stringify({
        to,
        subject,
        body: text,
        from: options?.from,
        replyTo: options?.replyTo,
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({})) as {
      success?: boolean
      message?: string
      sent?: string[]
      failed?: string[]
    }

    if (!response.ok || !data.success) {
      logger?.warn({
        status: response.status,
        to,
        message: data.message,
        failed: data.failed,
      }, 'crm mail failed')
      return false
    }

    return Array.isArray(data.sent) ? data.sent.length > 0 : true
  } catch (error) {
    logger?.warn({ err: error, to, url: url.toString() }, 'crm mail request failed')
    return false
  } finally {
    clearTimeout(timeout)
  }
}
