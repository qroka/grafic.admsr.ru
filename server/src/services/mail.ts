import { spawn } from 'node:child_process'
import type { FastifyBaseLogger } from 'fastify'
import type { Env } from '../config/env.js'

export interface MailConfig {
  enabled: boolean
  from: string
  replyTo: string
  subjectPrefix: string
  blacklist: Set<string>
  sendmailPath: string
}

export function buildMailConfig(env: Env): MailConfig {
  return {
    enabled: env.MAIL_ENABLED,
    from: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    subjectPrefix: env.MAIL_SUBJECT_PREFIX,
    blacklist: new Set(
      env.MAIL_BLACKLIST
        .split(/[,;]/)
        .map(email => email.trim().toLowerCase())
        .filter(Boolean),
    ),
    sendmailPath: env.MAIL_SENDMAIL_PATH,
  }
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

export async function sendPlainTextMail(
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

  // Как mail() в CRM: From, Reply-To, charset в заголовках; sendmail -t -i читает To из письма.
  const message = [
    `From: ${config.from}`,
    `Reply-To: ${config.replyTo}`,
    `To: ${recipient}`,
    `Subject: ${encodeSubject(fullSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
  ].join('\r\n')

  return new Promise((resolve) => {
    const proc = spawn(config.sendmailPath, ['-t', '-i'], {
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })

    proc.on('error', (err) => {
      logger?.warn({ err, to: recipient, sendmail: config.sendmailPath }, 'mail send failed')
      resolve(false)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        logger?.warn({
          code,
          to: recipient,
          sendmail: config.sendmailPath,
          stderr: stderr.trim() || undefined,
        }, 'sendmail exited with error')
        resolve(false)
        return
      }
      resolve(true)
    })

    proc.stdin.on('error', (err) => {
      logger?.warn({ err, to: recipient }, 'mail stdin failed')
      resolve(false)
    })

    proc.stdin.write(message, 'utf8')
    proc.stdin.end()
  })
}
