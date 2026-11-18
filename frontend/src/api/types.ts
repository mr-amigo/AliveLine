// Mirrors backend schemas (docs/PLAN.md §7).

export interface User {
  id: number
  email: string
  name: string
  daily_capacity_hours: number
  buffer_days: number
  /** Mon..Sun study hours; null → daily_capacity_hours every day. */
  weekday_hours: number[] | null
  max_session_hours: number
  min_session_hours: number
  interleave: boolean
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
  weekday_hours?: number[] | null
  max_session_hours?: number
  min_session_hours?: number
  interleave?: boolean
}

export type Status = 'can_wait' | 'time_to_start' | 'critical' | 'done'

export interface Estimate {
  hours: number
  rationale: string
  source: 'ai' | 'heuristic'
}

export interface WorkWindow {
  start_date: string
  target_finish: string
  status: Status
  /** Can't be finished before the deadline; `shortfall_hours` of it don't fit. */
  at_risk: boolean
  shortfall_hours: number
}

export interface Assignment {
  id: number
  title: string
  description: string
  course_name: string | null
  deadline: string
  source: string
  ai_hours: number | null
  ai_rationale: string | null
  estimate_source: string | null
  user_hours: number | null
  effective_hours: number
  done: boolean
  window: WorkWindow
}

export interface DayItem {
  assignment_id: number
  title: string
  course_name: string | null
  hours: number
  status: Status
}

export interface Day {
  date: string
  /** Study hours available that day (0 = day off). */
  capacity: number
  items: DayItem[]
}

export interface Plan {
  today: string
  capacity: number
  today_items: DayItem[]
  days: Day[]
  assignments: Assignment[]
}

export interface AssignmentCreate {
  title: string
  description?: string
  course_name?: string | null
  deadline: string
  user_hours?: number | null
  estimate?: Estimate
}

export type AssignmentUpdate = Partial<AssignmentCreate> & { done?: boolean }

export interface EstimateRequest {
  title: string
  description?: string
  course_name?: string | null
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  created_ids: number[]
}
