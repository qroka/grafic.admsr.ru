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

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token)
    localStorage.setItem(TOKEN_KEY, token)
  else
    localStorage.removeItem(TOKEN_KEY)
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body)
    headers.set('Content-Type', 'application/json')

  const token = getAuthToken()
  if (token)
    headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...options, headers })
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
    const err = data as { error?: string } | null
    throw new ApiError(err?.error ?? response.statusText, response.status, data)
  }

  return data as T
}
