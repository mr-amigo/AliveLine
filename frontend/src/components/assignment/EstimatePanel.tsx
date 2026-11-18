import { hoursLabel } from '../../lib/dates'
import { Button, Icon } from '../ui'
import HoursStepper from './HoursStepper'

export type EstimateOrigin = 'you' | 'ai' | 'heuristic'

const ORIGIN_LABEL: Record<EstimateOrigin, string> = {
  you: 'Your estimate',
  ai: 'AI estimate',
  heuristic: 'Rough estimate (AI unavailable)',
}

/** Hours for an assignment: AI value + rationale, manual correction, re-estimate. */
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
}) {
  return (
    <section aria-labelledby="estimate-heading" className="rounded-md border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="estimate-heading" className="text-label font-medium text-text-2">
          {origin ? ORIGIN_LABEL[origin] : 'How long will it take?'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onEstimate} loading={estimating} disabled={!canEstimate}>
          {!estimating && <Icon name="sparkle" />}
          {hours === null ? 'Estimate with AI' : 'Re-estimate'}
        </Button>
      </div>

      {hours === null ? (
        <p className="mt-2 text-meta text-text-2">
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
              <button type="button" onClick={onUseAi} className="text-meta text-text-2 underline underline-offset-2 hover:text-text">
                Use {aiIsAi ? 'AI’s' : 'suggested'} {hoursLabel(aiHours)}
              </button>
            )}
          </div>
          {rationale && origin !== 'you' && <p className="mt-2 text-meta text-text-2">{rationale}</p>}
        </>
      )}
    </section>
  )
}
