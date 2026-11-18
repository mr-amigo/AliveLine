import { useEffect } from 'react'

const SITE = 'AliveLine'
const DEFAULT_DESCRIPTION = 'AliveLine tells students when to start each assignment, not just when it’s due.'

function setMeta(selector: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
}

/** Per-route `<title>` and meta description (+ the OG/Twitter copies that index.html declares). */
export function usePageMeta(title: string | null, description = DEFAULT_DESCRIPTION): void {
  useEffect(() => {
    const full = title ? `${title} · ${SITE}` : `${SITE} — know when to start`
    document.title = full
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', full)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[name="twitter:title"]', full)
    setMeta('meta[name="twitter:description"]', description)
  }, [title, description])
}
