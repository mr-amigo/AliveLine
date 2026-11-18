import { Link } from 'react-router-dom'
import type { TrialFeature } from '../api/types'
import { trialHint, trialsUsedUp, useBilling } from '../lib/billing'

/** Next to a Pro feature on Free: "2 free tries left", or an upgrade link once they're used up. */
export default function ProHint({ feature, className = '' }: { feature: TrialFeature; className?: string }) {
  const b = useBilling()
  const hint = trialHint(b, feature)
  if (!hint) return null
  if (trialsUsedUp(b, feature))
    return (
      <Link to="/app/settings#plan" className={`text-meta font-medium text-accent hover:underline ${className}`}>
        Upgrade to Pro
      </Link>
    )
  return <span className={`tnum text-meta text-text-3 ${className}`}>{hint}</span>
}
