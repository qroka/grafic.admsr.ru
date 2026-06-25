import type { Env } from '../config/env.js'

export function parseCorsOrigins(corsOrigin: string): string[] {
  const origins = corsOrigin
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  if (!origins.length)
    throw new Error('CORS_ORIGIN must list at least one origin')

  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN cannot contain "*" when credentials are enabled. Use an explicit allowlist.',
    )
  }

  return origins
}

export function validateCorsOrigins(env: Env): void {
  parseCorsOrigins(env.CORS_ORIGIN)
}
