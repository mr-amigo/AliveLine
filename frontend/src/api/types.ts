// Mirrors backend schemas (docs/PLAN.md §7).

export interface User {
  id: number
  email: string
  name: string
  daily_capacity_hours: number
  buffer_days: number
  created_at: string
}

export interface SignUpData {
  email: string
  password: string
  name: string
}

export interface SignInData {
  email: string
  password: string
}

export interface SettingsUpdate {
  name?: string
  daily_capacity_hours?: number
  buffer_days?: number
}
