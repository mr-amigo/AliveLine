import type { Status } from '../api/types'

// Full class strings so Tailwind can see them (DESIGN.md §2 status = Notion select tags).
export const STATUS: Record<Status, { label: string; tint: string; text: string; dot: string; ring: string }> = {
  critical: { label: 'Critical', tint: 'bg-critical-tint', text: 'text-critical-text', dot: 'bg-critical', ring: 'ring-critical' },
  time_to_start: { label: 'Time to start', tint: 'bg-start-tint', text: 'text-start-text', dot: 'bg-start', ring: 'ring-start' },
  can_wait: { label: 'Can wait', tint: 'bg-wait-tint', text: 'text-wait-text', dot: 'bg-wait', ring: 'ring-wait' },
  done: { label: 'Done', tint: 'bg-done-tint', text: 'text-done-text', dot: 'bg-done', ring: 'ring-done' },
}

export const STATUS_ORDER: Status[] = ['critical', 'time_to_start', 'can_wait', 'done']

// DESIGN.md course colours (Notion blue, purple, pink, green, yellow, brown): solid / tag bg / tag text.
// The API exposes course names, not ids, so the index is a stable name hash.
const COURSE_COLORS = [
  ['#337EA9', '#D3E5EF', '#183347'],
  ['#9065B0', '#E8DEEE', '#412454'],
  ['#C14C8A', '#F5E0E9', '#4C2337'],
  ['#448361', '#DBEDDB', '#1C3829'],
  ['#CB912F', '#FDECC8', '#402C1B'],
  ['#9F6B53', '#EEE0DA', '#442A1E'],
] as const

function courseIndex(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % COURSE_COLORS.length
}

export function courseColor(name: string | null): string {
  return name ? COURSE_COLORS[courseIndex(name)][0] : 'var(--color-line-strong)'
}

/** Inline style for a course rendered as a Notion select tag. */
export function courseTag(name: string | null): { background: string; color: string } {
  if (!name) return { background: 'var(--color-wait-tint)', color: 'var(--color-wait-text)' }
  const [, background, color] = COURSE_COLORS[courseIndex(name)]
  return { background, color }
}

/** Key used for course visibility toggles ('' = no course). */
export const courseKey = (name: string | null) => name ?? ''
