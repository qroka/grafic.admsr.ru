const TOKEN_KEY = 'crm_auth_token'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** @deprecated JWT хранится в HttpOnly cookie; оставлено для миграции со старых сессий. */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** @deprecated */
export function setAuthToken(token: string | null): void {
  if (token)
    localStorage.setItem(TOKEN_KEY, token)
  else
    localStorage.removeItem(TOKEN_KEY)
}

/** Удаляет устаревший токен из localStorage после перехода на cookie. */
export function clearLegacyAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

function shouldNotifyUnauthorized(path: string): boolean {
  if (path === '/api/auth/me')
    return false
  if (path.startsWith('/api/auth/login')
    || path.startsWith('/api/auth/crm-')
    || path === '/api/auth/logout') {
    return false
  }
  return true
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body)
    headers.set('Content-Type', 'application/json')

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!response.ok) {
    if (response.status === 401 && shouldNotifyUnauthorized(path))
      unauthorizedHandler?.()

    const err = data as { error?: string } | null
    throw new ApiError(err?.error ?? response.statusText, response.status, data)
  }

  return data as T
}
