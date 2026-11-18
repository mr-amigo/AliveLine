import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, planApi } from '../api/client'
import type { Plan } from '../api/types'

export interface PlanState {
  plan: Plan | null
  loading: boolean
  /** true after 3 s of a pending request (server waking up). */
  slow: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Fetches /plan for `days` days starting at `from`. Keeps old data while refetching. */
export function usePlan(from: string, days: number): PlanState {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => id === latest.current && setSlow(true), 3000)
    try {
      const data = await planApi.get(from, days)
      if (id === latest.current) setPlan(data)
    } catch (err) {
      if (id === latest.current) setError(err instanceof ApiError ? err.message : 'Could not load your plan')
    } finally {
      window.clearTimeout(timer)
      if (id === latest.current) {
        setLoading(false)
        setSlow(false)
      }
    }
  }, [from, days])

  useEffect(() => {
    void load()
  }, [load])

  return { plan, loading, slow, error, reload: load }
}
