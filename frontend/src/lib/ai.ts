import { aiApi, billingApi } from '../api/client'
import type { ClaimFeature, Estimate, EstimateRequest, StepDraft, StepsRequest } from '../api/types'
import { billingStore } from './billing'

/** Counts one use against the plan (402 = Pro needed, 429 = monthly cap) and returns the AI permission. */
export async function claim(feature: ClaimFeature, opts: { assignment_id?: number } = {}): Promise<string> {
  const res = await billingApi.claim(feature, opts)
  billingStore.set(res.billing)
  return res.token
}

/** First AI estimate is free; asking again for an AI-estimated assignment is a re-estimate (Pro, trial uses). */
export async function aiEstimate(data: EstimateRequest, assignmentId?: number): Promise<Estimate> {
  return aiApi.estimate(data, await claim('estimate', assignmentId ? { assignment_id: assignmentId } : {}))
}

export async function aiSteps(data: StepsRequest): Promise<StepDraft[]> {
  return (await aiApi.steps(data, await claim('steps'))).steps
}
