import { aiApi, assignmentsApi } from '../api/client'
import type { Assignment } from '../api/types'

/** Max items one AI pass touches (sequential calls; keeps a pass under ~1 min). */
export const AI_CAP = 30

/** Items still on the server's rule-based estimate (no AI hours, no own hours). */
export const needsAi = (a: Assignment) => !a.done && a.user_hours === null && a.estimate_source !== 'ai'

/**
 * Asks the AI for each item in turn and saves AI answers as the estimate.
 * Returns how many got an AI estimate; throws the first API error.
 */
export async function estimateWithAi(items: Assignment[], onProgress: (done: number) => void): Promise<number> {
  let estimated = 0
  for (const [i, a] of items.slice(0, AI_CAP).entries()) {
    const e = await aiApi.estimate({ title: a.title, description: a.description, course_name: a.course_name })
    if (e.source === 'ai') {
      await assignmentsApi.update(a.id, { estimate: { ...e, rationale: e.rationale.slice(0, 500) } })
      estimated++
    }
    onProgress(i + 1)
  }
  return estimated
}
