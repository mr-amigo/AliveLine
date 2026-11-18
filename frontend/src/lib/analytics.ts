// Cookieless page counts via GoatCounter (no personal data, no cookie banner needed).
// Enabled only when the build has VITE_GOATCOUNTER=<site code> (root .env → make aws-publish).

declare global {
  interface Window {
    goatcounter?: { count: (vars: { path: string; title?: string }) => void }
  }
}

const CODE = import.meta.env.VITE_GOATCOUNTER as string | undefined
let pending: string | null = null

export function initAnalytics(): void {
  if (!CODE || !/^[a-z0-9-]+$/.test(CODE)) return
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.dataset.goatcounter = `https://${CODE}.goatcounter.com/count`
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true })
  s.onload = () => {
    if (pending) countPage(pending)
  }
  document.head.appendChild(s)
}

/** Counts a page view by path only (no query string: it can hold dates or ids). */
export function countPage(path: string): void {
  if (!CODE) return
  if (window.goatcounter) window.goatcounter.count({ path })
  else pending = path
}
