import type { SettingsUpdate, SignInData, SignUpData, User } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      // FastAPI validation errors: [{loc: [..., field], msg}]
      return body.detail
        .map((e: { loc?: unknown[]; msg: string }) => {
          const field = e.loc?.[e.loc.length - 1]
          return typeof field === 'string' ? `${field}: ${e.msg}` : e.msg
        })
        .join('; ')
    }
  } catch {
    /* non-JSON body */
  }
  return res.statusText || 'Something went wrong'
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.')
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
}

export const authApi = {
  me: () => api.get<User>('/auth/me'),
  signUp: (data: SignUpData) => api.post<User>('/auth/signup', data),
  signIn: (data: SignInData) => api.post<User>('/auth/signin', data),
  signOut: () => api.post<void>('/auth/signout'),
}

export const settingsApi = {
  update: (data: SettingsUpdate) => api.patch<User>('/settings', data),
}

export const waitlistApi = {
  join: (email: string) => api.post<void>('/waitlist', { email }),
}
