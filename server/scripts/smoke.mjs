import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const serverRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const port = 31999
const login = 'smoke_admin'
const password = 'smoke_secret_42'

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  return { response, data }
}

async function waitForHealth(baseUrl, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const { response, data } = await fetchJson(`${baseUrl}/api/health`)
      if (response.ok && data?.ok)
        return
    } catch {
      // server still starting
    }
    await sleep(250)
  }
  throw new Error('Server did not become healthy in time')
}

async function main() {
  const tmpDir = await mkdtemp(join(tmpdir(), 'crm-smoke-'))
  const sqlitePath = join(tmpDir, 'crm.sqlite')
  const uploadDir = join(tmpDir, 'uploads')
  const baseUrl = `http://127.0.0.1:${port}`

  const child = spawn(
    process.execPath,
    [join(serverRoot, 'dist/index.js')],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(port),
        SQLITE_PATH: sqlitePath,
        UPLOAD_DIR: uploadDir,
        JWT_SECRET: 'smoke-test-jwt-secret-min-32-chars',
        JWT_EXPIRES_IN: '1h',
        SEED_USER_LOGIN: login,
        SEED_USER_PASSWORD: password,
        CRM_MOCK: 'true',
        CORS_ORIGIN: 'http://localhost:5173',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  let failed = false

  try {
    await waitForHealth(baseUrl)

    const health = await fetchJson(`${baseUrl}/api/health`)
    if (!health.response.ok || !health.data?.service) {
      throw new Error(`Unexpected health: ${JSON.stringify(health.data)}`)
    }
    if (health.data.db !== undefined) {
      throw new Error('Public health must not expose db details')
    }

    const loginRes = await fetchJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    })
    if (!loginRes.response.ok || !loginRes.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`)
    }

    const token = loginRes.data.token
    const eventsRes = await fetchJson(`${baseUrl}/api/events`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!eventsRes.response.ok || !eventsRes.data?.success) {
      throw new Error(`List events failed: ${JSON.stringify(eventsRes.data)}`)
    }

    console.log('smoke: ok')
  } catch (error) {
    failed = true
    console.error('smoke: failed', error instanceof Error ? error.message : error)
    if (child.stderr) {
      const stderr = await new Promise(resolve => {
        let buf = ''
        child.stderr.on('data', chunk => { buf += chunk })
        child.stderr.on('end', () => resolve(buf))
        setTimeout(() => resolve(buf), 500)
      })
      if (stderr)
        console.error(stderr)
    }
  } finally {
    child.kill('SIGTERM')
    await sleep(300)
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }

  process.exit(failed ? 1 : 0)
}

main()
