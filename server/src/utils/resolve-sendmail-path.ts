import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const SENDMAIL_CANDIDATES = [
  '/usr/sbin/sendmail',
  '/usr/bin/sendmail',
  '/etc/alternatives/sendmail',
]

/** Ищет sendmail/postfix на сервере (PHP mail() использует тот же бинарник). */
export function resolveSendmailPath(configured?: string): string | null {
  const preferred = configured?.trim()
  if (preferred) {
    if (preferred.includes('/')) {
      if (existsSync(preferred))
        return preferred
    } else {
      return preferred
    }
  }

  for (const candidate of SENDMAIL_CANDIDATES) {
    if (existsSync(candidate))
      return candidate
  }

  try {
    const resolved = execFileSync('which', ['sendmail'], { encoding: 'utf8' }).trim()
    if (resolved && existsSync(resolved))
      return resolved
  } catch {
    // which не нашёл sendmail
  }

  return null
}
