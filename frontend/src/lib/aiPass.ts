import { aiApi, assignmentsApi } from '../api/client'
import type { Assignment } from '../api/types'
import { claim } from './ai'

/** Max items one AI pass touches (sequential calls; keeps a pass under ~1 min). */
export const AI_CAP = 30

/** Items still on the server's rule-based estimate (no AI hours, no own hours). */
export const needsAi = (a: Assignment) => !a.done && a.user_hours === null && a.estimate_source !== 'ai'

/**
 * Asks the AI for each item in turn and saves AI answers as the estimate.
 * `bulk` = "Estimate all with AI" (Pro feature, one claim for the pass); otherwise each item is a free first estimate
 * (import). Returns how many got an AI estimate; throws the first API error (402/429 included).
 */
export async function estimateWithAi(items: Assignment[], onProgress: (done: number) => void, bulk = false): Promise<number> {
  const list = items.slice(0, AI_CAP)
  const bulkToken = bulk && list.length ? await claim('bulk', { count: list.length }) : null
  let estimated = 0
  for (const [i, a] of list.entries()) {
    const token = bulkToken ?? (await claim('estimate', { assignment_id: a.id }))
    const e = await aiApi.estimate({ title: a.title, description: a.description, course_name: a.course_name }, token)
    if (e.source === 'ai') {
      await assignmentsApi.update(a.id, { estimate: { ...e, rationale: e.rationale.slice(0, 500) } })
      estimated++
    }
    onProgress(i + 1)
  }
  return estimated
}
