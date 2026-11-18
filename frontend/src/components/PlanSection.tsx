import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { isPro, openCheckout, openPortal, useBilling, waitForPro } from '../lib/billing'
import { Button, Icon, useToast } from './ui'

export const PRICES = { monthly: '$3', yearly: '$24' }

const FEATURE_LABEL = { steps: 'AI steps', bulk: 'Estimate all with AI', reestimate: 'Re-estimate with AI' } as const

/** Settings → Plan: current plan, limits, upgrade (Paddle overlay) or manage subscription (Paddle portal). */
export default function PlanSection() {
  const b = useBilling()
  const { user } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<'monthly' | 'yearly' | 'portal' | 'waiting' | null>(null)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.location.hash === '#plan') ref.current?.scrollIntoView({ block: 'start' })
  }, [b !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  async function upgrade(period: 'monthly' | 'yearly') {
    if (!b?.checkout || !user) return
    setBusy(period)
    try {
      await openCheckout(b.checkout, period, user, async () => {
        setBusy('waiting')
        const ok = await waitForPro()
        setBusy(null)
        toast(ok ? 'Welcome to Pro' : 'Payment received. Pro turns on in a minute; refresh if it doesn’t.')
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open checkout', 'error')
    }
    setBusy((v) => (v === 'waiting' ? v : null))
  }

  async function manage() {
    setBusy('portal')
    try {
      await openPortal()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not open the billing portal', 'error')
      setBusy(null)
    }
  }

  const pro = isPro(b)
  return (
    <section ref={ref} id="plan" aria-labelledby="plan-heading" className="mt-10 scroll-mt-4">
      <h2 id="plan-heading" className="border-b border-line pb-3 text-section font-medium">Plan</h2>
      {!b ? (
        <p className="py-3.5 text-body text-text-2">Loading…</p>
      ) : (
        <div className="space-y-4 py-3.5 text-body">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span className="font-semibold">{pro ? 'Pro' : 'Free'}</span>
              <span className="text-text-2">
                {pro
                  ? b.plan_until
                    ? ` · ${b.subscription_status === 'cancels' || b.subscription_status === 'canceled' ? 'ends' : 'renews'} ${new Date(b.plan_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : ''
                  : ' · deadlines, Moodle import, planner and AI estimates, free for good'}
              </span>
            </p>
            {pro && b.can_manage && (
              <Button variant="secondary" size="sm" onClick={() => void manage()} loading={busy === 'portal'}>
                Manage subscription
              </Button>
            )}
          </div>

          <p className="tnum text-meta text-text-2">
            AI estimates this month: {b.ai_used} of {b.ai_limit}
          </p>

          {!pro && (
            <>
              <ul className="space-y-1">
                {(Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[]).map((f) => (
                  <li key={f} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <Icon name="sparkle" className="text-text-3" />
                      {FEATURE_LABEL[f]}
                    </span>
                    <span className="tnum text-meta text-text-2">
                      {b.trials_left[f] > 0 ? `${b.trials_left[f]} free tries left` : 'Pro'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="rounded bg-callout px-4 py-3.5">
                <p className="font-semibold">AliveLine Pro</p>
                <p className="mt-0.5 text-text-2">
                  Unlimited AI steps, re-estimates and “Estimate all”, 10× the monthly AI estimates. Cancel any time.
                </p>
                {b.checkout ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void upgrade('monthly')} loading={busy === 'monthly'} disabled={busy !== null}>
                      {PRICES.monthly} / month
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void upgrade('yearly')} loading={busy === 'yearly'} disabled={busy !== null}>
                      {PRICES.yearly} / year · save 33%
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-meta font-medium text-text-2">Payments open soon. Your free tries keep working until then.</p>
                )}
                {busy === 'waiting' && <p className="mt-2 text-meta text-text-2">Confirming your payment…</p>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
