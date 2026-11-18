import { useSyncExternalStore } from 'react'
import { aiApi, billingApi } from '../api/client'
import type { Billing, CheckoutConfig, TrialFeature } from '../api/types'

// Tiny store for the user's plan + limits: loaded once in the app shell, updated by every claim.
let state: Billing | null = null
const listeners = new Set<() => void>()

function set(next: Billing) {
  // Claims don't carry checkout config; keep the last one.
  state = { ...next, checkout: next.checkout !== undefined ? next.checkout : state?.checkout ?? null }
  listeners.forEach((l) => l())
}

export const billingStore = {
  set,
  async load(): Promise<void> {
    set(await billingApi.get())
  },
  clear() {
    state = null
    listeners.forEach((l) => l())
  },
}

export function useBilling(): Billing | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export const isPro = (b: Billing | null) => b?.plan === 'pro'

/** "2 free tries left" / "Pro" hint for a Pro feature; null while loading or on Pro. */
export function trialHint(b: Billing | null, feature: TrialFeature): string | null {
  if (!b || isPro(b)) return null
  const n = b.trials_left[feature]
  return n > 0 ? `${n} free ${n === 1 ? 'try' : 'tries'} left` : 'Pro'
}

export const trialsUsedUp = (b: Billing | null, feature: TrialFeature) => !!b && !isPro(b) && b.trials_left[feature] === 0

// ---- Paddle.js checkout (overlay) ----

interface PaddleJs {
  Environment: { set: (env: string) => void }
  Initialize: (opts: { token: string; eventCallback?: (e: { name: string }) => void }) => void
  Checkout: { open: (opts: Record<string, unknown>) => void }
}
declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

let paddle: Promise<PaddleJs> | null = null
let onCompleted: (() => void) | null = null

function loadPaddle(cfg: CheckoutConfig): Promise<PaddleJs> {
  paddle ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    s.onload = () => {
      const p = window.Paddle!
      if (cfg.environment === 'sandbox') p.Environment.set('sandbox')
      p.Initialize({ token: cfg.client_token, eventCallback: (e) => e.name === 'checkout.completed' && onCompleted?.() })
      resolve(p)
    }
    s.onerror = () => {
      paddle = null
      reject(new Error('Could not load the payment form. Check your connection or ad blocker.'))
    }
    document.head.appendChild(s)
  })
  return paddle
}

/** Opens Paddle's overlay checkout; `done` runs after a successful payment (the webhook then turns Pro on). */
export async function openCheckout(cfg: CheckoutConfig, period: 'monthly' | 'yearly', user: { id: number; email: string }, done: () => void) {
  const p = await loadPaddle(cfg)
  onCompleted = done
  p.Checkout.open({
    items: [{ priceId: cfg.prices[period], quantity: 1 }],
    customer: { email: user.email },
    customData: { user_id: String(user.id) },
    settings: { displayMode: 'overlay', theme: 'light', locale: 'en' },
  })
}

/** Paddle customer portal (card, cancel, invoices): backend signs, AI Lambda asks Paddle. */
export async function openPortal(): Promise<void> {
  const { token } = await billingApi.portalClaim()
  const { url } = await aiApi.portal(token)
  window.location.href = url
}

/** After checkout: poll until the webhook has switched the plan (usually a few seconds). */
export async function waitForPro(tries = 10): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    await billingStore.load()
    if (state?.plan === 'pro') return true
  }
  return false
}
