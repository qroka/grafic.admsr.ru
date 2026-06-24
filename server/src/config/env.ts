import { z } from 'zod'

export const DEV_JWT_SECRET = 'dev-only-change-before-production'
export const DEFAULT_CRM_SYNC_SECRET = 'asu_corporate_sync_key'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.union([
    z.string().min(1),
    z.coerce.number().int().positive(),
  ]).default('8h'),
  SQLITE_PATH: z.string().default('../data/crm.sqlite'),
  UPLOAD_DIR: z.string().default('../data/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  SEED_USER_LOGIN: z.string().default('admin'),
  SEED_USER_PASSWORD: z.string().min(4).default('admin'),
  CRM_MOCK: z
    .enum(['true', 'false'])
    .default('true')
    .transform(v => v === 'true'),
  CRM_BASE_URL: z.string().url().default('https://172.17.30.42'),
  CRM_PARTICIPANTS_PATH: z.string().default('/api/users.php'),
  CRM_SYNC_SECRET: z.string().default(DEFAULT_CRM_SYNC_SECRET),
  CRM_HOST_HEADER: z.string().default('asu.admsr.ru'),
  CRM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CRM_DB_HOST: z.string().optional(),
  CRM_DB_PORT: z.coerce.number().int().positive().default(3306),
  CRM_DB_USER: z.string().optional(),
  CRM_DB_PASSWORD: z.string().default(''),
  CRM_DB_NAME: z.string().default('crm'),
  /** URL crm_lookup.php на сервере CRM (POST login/password). */
  CRM_LOOKUP_URL: z.string().url().optional(),
  /** Секрет для SSO-токена из schedule.php (тот же SCHEDULE_SSO_SECRET / CRM_LOOKUP_SECRET в PHP). */
  SCHEDULE_SSO_SECRET: z.string().optional(),
  /** Отправка почты: crm — через crm_send_mail.php на 30.42, sendmail — локально. */
  MAIL_TRANSPORT: z.enum(['crm', 'sendmail']).default('crm'),
  CRM_MAIL_PATH: z.string().default('/crm_send_mail.php'),
  MAIL_ENABLED: z
    .string()
    .default('false')
    .transform(v => ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase())),
  MAIL_FROM: z.string().email().default('postmaster@admsr.ru'),
  MAIL_REPLY_TO: z.string().email().default('postmaster@admsr.ru'),
  MAIL_SUBJECT_PREFIX: z.string().default('График заместителей'),
  MAIL_BLACKLIST: z.string().default(''),
  /** Пусто — авто-поиск (/usr/sbin/sendmail, /usr/bin/sendmail, which sendmail). */
  MAIL_SENDMAIL_PATH: z.string().default(''),
})

export type Env = z.infer<typeof envSchema>

function validateProductionSecrets(data: z.infer<typeof envSchema>): void {
  if (data.NODE_ENV !== 'production')
    return

  const issues: string[] = []

  if (data.JWT_SECRET === DEV_JWT_SECRET) {
    issues.push(
      'JWT_SECRET: в production нельзя использовать значение по умолчанию (dev-only-change-before-production). Задайте случайную строку ≥32 символов.',
    )
  }

  if (data.SEED_USER_PASSWORD === 'admin') {
    issues.push(
      'SEED_USER_PASSWORD: в production пароль seed не может быть "admin".',
    )
  }

  if (issues.length)
    throw new Error(`Invalid environment (production):\n${issues.join('\n')}`)
}

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment:\n${message}`)
  }

  validateProductionSecrets(parsed.data)
  return parsed.data
}
