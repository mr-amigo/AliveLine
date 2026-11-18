import { trialsUsedUp, useBilling } from '../../lib/billing'
import { hoursLabel } from '../../lib/dates'
import ProHint from '../ProHint'
import { Button, Icon } from '../ui'
import HoursStepper from './HoursStepper'

export type EstimateOrigin = 'you' | 'ai' | 'heuristic'

const ORIGIN_LABEL: Record<EstimateOrigin, string> = {
  you: 'Your estimate',
  ai: 'AI estimate',
  heuristic: 'Rough estimate',
}

/** Hours for an assignment as a Notion callout: AI value + rationale, manual correction, re-estimate. */
export default function EstimatePanel({
  hours,
  origin,
  rationale,
  aiHours,
  aiIsAi,
  estimating,
  canEstimate,
  onHours,
  onEstimate,
  onUseAi,
  reestimate = false,
}: {
  hours: number | null
  origin: EstimateOrigin | null
  rationale: string | null
  aiHours: number | null
  aiIsAi: boolean
  estimating: boolean
  canEstimate: boolean
  onHours: (h: number) => void
  onEstimate: () => void
  onUseAi: () => void
  /** The AI already estimated this saved assignment: asking again is a Pro feature (trial uses on Free). */
  reestimate?: boolean
}) {
  const locked = reestimate && trialsUsedUp(useBilling(), 'reestimate')
  return (
    <section aria-labelledby="estimate-heading" className="flex gap-3 rounded bg-callout px-4 py-3.5 text-body">
      <Icon name="sparkle" className="mt-0.5 text-start" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="estimate-heading" className="font-semibold">
            {origin ? ORIGIN_LABEL[origin] : 'How long will it take?'}
          </h3>
          <div className="flex items-center gap-2">
            {reestimate && <ProHint feature="reestimate" />}
            {!locked && (
              <Button variant="secondary" size="sm" onClick={onEstimate} loading={estimating} disabled={!canEstimate} className="bg-transparent">
                {hours === null || origin === 'heuristic' ? 'Estimate with AI' : 'Re-estimate'}
              </Button>
            )}
          </div>
        </div>

        {hours === null ? (
          <p className="mt-1 text-text-2">
            AI reads the title and description and suggests hours. Leave it and it runs when you save, or{' '}
            <button type="button" className="font-medium text-text underline underline-offset-2" onClick={() => onHours(3)}>
              set hours yourself
            </button>
            .
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <HoursStepper value={hours} onChange={onHours} />
              {origin === 'you' && aiHours !== null && (
                <button type="button" onClick={onUseAi} className="text-text-2 underline underline-offset-2 hover:text-text">
                  Use {aiIsAi ? 'AI’s' : 'suggested'} {hoursLabel(aiHours)}
                </button>
              )}
            </div>
            {rationale && origin !== 'you' && <p className="mt-2 text-text-2">{rationale}</p>}
          </>
        )}
      </div>
    </section>
  )
}
