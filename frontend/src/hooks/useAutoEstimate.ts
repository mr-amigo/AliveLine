import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import type { Plan } from '../api/types'
import { AI_CAP, estimateWithAi, needsAi } from '../lib/aiPass'

/** Ids already sent to the AI this session: a failure (AI down, monthly cap) never loops. */
const attempted = new Set<number>()
export const markAttempted = (ids: number[]) => ids.forEach((id) => attempted.add(id))

/**
 * "AI estimates" setting on (default): any assignment still on the rule-based estimate (imported or added while the
 * AI pass didn't run, or AI was down) is estimated by AI in the background, a few at a time. Returns progress.
 */
export function useAutoEstimate(plan: Plan | null, enabled: boolean, reload: () => Promise<void>): { done: number; total: number } | null {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const running = useRef(false)

  useEffect(() => {
    if (!enabled || !plan || running.current) return
    const items = plan.assignments.filter((a) => needsAi(a) && !attempted.has(a.id)).slice(0, AI_CAP)
    if (!items.length) return
    running.current = true
    markAttempted(items.map((a) => a.id))
    setProgress({ done: 0, total: items.length })
    estimateWithAi(items, (done) => setProgress({ done, total: items.length }))
      .catch((err) => {
        if (!(err instanceof ApiError)) throw err // 429 monthly cap / AI down: keep the rough estimates quietly
      })
      .finally(async () => {
        running.current = false
        setProgress(null)
        await reload()
      })
  }, [plan, enabled, reload])

  return progress
}
