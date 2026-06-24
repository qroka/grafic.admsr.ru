import { spawn } from 'node:child_process'
import type { FastifyBaseLogger } from 'fastify'
import type { Env } from '../config/env.js'
import { resolveSendmailPath } from '../utils/resolve-sendmail-path.js'
import { sendMailViaCrm } from './crm-mail.js'

export type MailTransport = 'crm' | 'sendmail'

export interface MailConfig {
  enabled: boolean
  transport: MailTransport
  from: string
  replyTo: string
  subjectPrefix: string
  blacklist: Set<string>
  sendmailPath: string | null
}

export function buildMailConfig(env: Env): MailConfig {
  const transport = env.MAIL_TRANSPORT
  return {
    enabled: env.MAIL_ENABLED,
    transport,
    from: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    subjectPrefix: env.MAIL_SUBJECT_PREFIX,
    blacklist: new Set(
      env.MAIL_BLACKLIST
        .split(/[,;]/)
        .map(email => email.trim().toLowerCase())
        .filter(Boolean),
    ),
    sendmailPath: transport === 'sendmail'
      ? resolveSendmailPath(env.MAIL_SENDMAIL_PATH)
      : null,
  }
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

async function sendPlainTextMailSendmail(
  config: MailConfig,
  to: string,
  subject: string,
  text: string,
  logger?: Pick<FastifyBaseLogger, 'warn' | 'info'>,
): Promise<boolean> {
  if (!config.sendmailPath) {
    logger?.warn({ to }, 'mail send skipped: sendmail not found on server')
    return false
  }

  const message = [
    `From: ${config.from}`,
    `Reply-To: ${config.replyTo}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
  ].join('\r\n')

  return new Promise((resolve) => {
    const proc = spawn(config.sendmailPath!, ['-t', '-i'], {
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })

    proc.on('error', (err) => {
      logger?.warn({ err, to, sendmail: config.sendmailPath }, 'mail send failed')
      resolve(false)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        logger?.warn({
          code,
          to,
          sendmail: config.sendmailPath,
          stderr: stderr.trim() || undefined,
        }, 'sendmail exited with error')
        resolve(false)
        return
      }
      resolve(true)
    })

    proc.stdin.on('error', (err) => {
      logger?.warn({ err, to }, 'mail stdin failed')
      resolve(false)
    })

    proc.stdin.write(message, 'utf8')
    proc.stdin.end()
  })
}

export async function sendPlainTextMail(
  env: Env,
  config: MailConfig,
  to: string,
  subject: string,
  text: string,
  logger?: Pick<FastifyBaseLogger, 'warn' | 'info'>,
): Promise<boolean> {
  if (!config.enabled)
    return false

  const recipient = to.trim()
  const normalized = recipient.toLowerCase()
  if (!normalized || config.blacklist.has(normalized))
    return false

  const fullSubject = config.subjectPrefix
    ? `${config.subjectPrefix} / ${subject}`
    : subject

  if (config.transport === 'crm') {
    return sendMailViaCrm(
      env,
      recipient,
      fullSubject,
      text,
      { from: config.from, replyTo: config.replyTo },
      logger,
    )
  }

  return sendPlainTextMailSendmail(config, recipient, fullSubject, text, logger)
}
