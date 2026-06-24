const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailSource = string | null | undefined | EmailSource[]

function trimEmailToken(part: string): string {
  return part.trim().replace(/^[<>"']+|[<>"']+$/g, '').toLowerCase()
}

/** Как mail_collect_emails() в CRM: несколько полей, разделители , ; и пробелы. */
export function collectEmailAddresses(sources: EmailSource): string[] {
  const emails: string[] = []
  const queue: EmailSource[] = [sources]

  while (queue.length) {
    const source = queue.shift()
    if (source == null)
      continue

    if (Array.isArray(source)) {
      queue.push(...source)
      continue
    }

    const raw = String(source)
    if (!raw.trim())
      continue

    const normalized = raw.replace(/[\r\n\t]/g, ' ')
    const parts = normalized.split(/[,;\s]+/)

    for (const part of parts) {
      const email = trimEmailToken(part)
      if (!email || !EMAIL_RE.test(email) || emails.includes(email))
        continue
      emails.push(email)
    }
  }

  return emails
}

/** @deprecated используйте collectEmailAddresses */
export function parseEmailAddresses(raw: string | null | undefined): string[] {
  return collectEmailAddresses(raw)
}
