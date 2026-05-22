import { config as loadDotenv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './config/env.js'
import { buildApp } from './app.js'
import { logActivity } from './services/activity-log.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
loadDotenv({ path: resolve(rootDir, '.env') })

async function main() {
  const env = loadEnv()
  const app = await buildApp(env)

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    logActivity(env, {
      level: 'info',
      category: 'system',
      action: 'system.start',
      message: 'Запуск API CRM Vue',
    }, app.log)
    app.log.info(`CRM API listening on http://${env.HOST}:${env.PORT}`)
    app.log.info(`SQLite: ${env.SQLITE_PATH}`)
    app.log.info(`CRM participants mock: ${env.CRM_MOCK}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

main()
