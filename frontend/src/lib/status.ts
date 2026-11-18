import type { Status } from '../api/types'

// Full class strings so Tailwind can see them (DESIGN.md §2 status palette).
export const STATUS: Record<Status, { label: string; tint: string; text: string; dot: string; ring: string }> = {
  critical: { label: 'Critical', tint: 'bg-critical-tint', text: 'text-critical-text', dot: 'bg-critical', ring: 'ring-critical' },
  time_to_start: { label: 'Time to start', tint: 'bg-start-tint', text: 'text-start-text', dot: 'bg-start', ring: 'ring-start' },
  can_wait: { label: 'Can wait', tint: 'bg-wait-tint', text: 'text-wait-text', dot: 'bg-wait', ring: 'ring-wait' },
  done: { label: 'Done', tint: 'bg-done-tint', text: 'text-done-text line-through', dot: 'bg-done', ring: 'ring-done' },
}

export const STATUS_ORDER: Status[] = ['critical', 'time_to_start', 'can_wait', 'done']

// DESIGN.md course colours. The API exposes course names, not ids, so the index is a stable name hash.
const COURSE_COLORS = ['#2F80ED', '#9065B0', '#C14C8A', '#0F7B6C', '#CB912F', '#9F6B53']

export function courseColor(name: string | null): string {
  if (!name) return 'var(--color-line-strong)'
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COURSE_COLORS[h % COURSE_COLORS.length]
}

/** Key used for course visibility toggles ('' = no course). */
export const courseKey = (name: string | null) => name ?? ''
