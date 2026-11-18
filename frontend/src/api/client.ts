import type {
  Assignment,
  AssignmentCreate,
  AssignmentUpdate,
  Billing,
  ClaimFeature,
  ClaimOut,
  Estimate,
  EstimateRequest,
  ImportResult,
  Plan,
  SettingsUpdate,
  SignInData,
  SignUpData,
  StepDraft,
  StepsRequest,
  User,
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

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

async function request<T>(method: Method, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const init: RequestInit = { method, credentials: 'include', headers }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { ...headers, 'Content-Type': 'application/json' }
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
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => request<T>('POST', path, body, headers),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
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

export const planApi = {
  get: (from: string, days = 7) => api.get<Plan>(`/plan?from=${from}&days=${days}`),
}

export const assignmentsApi = {
  create: (data: AssignmentCreate) => api.post<Assignment>('/assignments', data),
  update: (id: number, data: AssignmentUpdate) => api.patch<Assignment>(`/assignments/${id}`, data),
  remove: (id: number) => api.del(`/assignments/${id}`),
  setSteps: (id: number, steps: StepDraft[]) => api.put<Assignment>(`/assignments/${id}/steps`, { steps }),
}

/** AI Lambda calls need a fresh claim token from billingApi.claim (see lib/ai.ts). */
export const aiApi = {
  estimate: (data: EstimateRequest, claim: string) => api.post<Estimate>('/ai/estimate', data, { 'X-AI-Claim': claim }),
  steps: (data: StepsRequest, claim: string) => api.post<{ steps: StepDraft[] }>('/ai/steps', data, { 'X-AI-Claim': claim }),
  portal: (claim: string) => api.post<{ url: string }>('/ai/portal', undefined, { 'X-Portal-Claim': claim }),
}

export const billingApi = {
  get: () => api.get<Billing>('/billing'),
  claim: (feature: ClaimFeature, opts: { assignment_id?: number } = {}) =>
    api.post<ClaimOut>('/billing/claim', { feature, ...opts }),
  portalClaim: () => api.post<{ token: string }>('/billing/portal-claim'),
}

export const importApi = {
  ics: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ImportResult>('/import/ics', form)
  },
}
