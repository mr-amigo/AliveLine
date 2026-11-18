import { useEffect, useRef } from 'react'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Single-key shortcuts (DESIGN.md §7), ignored while typing or with modifiers. Keys: `e.key` values, letters lowercase. */
export function useShortcuts(map: Record<string, () => void>, enabled = true): void {
  const ref = useRef(map)
  ref.current = map

  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const fn = ref.current[key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
