import type { DayItem } from '../../api/types'
import { hoursLabel } from '../../lib/dates'
import { courseColor, STATUS } from '../../lib/status'

export const HOUR_PX = 28

/** A day's slice of work on one assignment; height ∝ hours (DESIGN.md §5). */
export default function WorkBlock({
  item,
  selected,
  past,
  onSelect,
}: {
  item: DayItem
  selected: boolean
  past: boolean
  onSelect?: (id: number) => void
}) {
  const s = STATUS[item.status]
  const height = Math.max(22, item.hours * HOUR_PX - 2)
  const oneLine = height < 40
  const className = `relative flex w-full min-w-0 overflow-hidden rounded border-l-[3px] px-1.5 py-1 text-left ${s.tint} ${
    s.text
  } ${selected ? `ring-1 ${s.ring}` : ''} ${past ? 'opacity-60' : ''} ${
    oneLine ? 'items-center gap-1.5' : 'flex-col'
  } transition-shadow duration-[120ms] hover:shadow-[inset_0_0_0_999px_rgba(55,53,47,0.06)]`
  const content = (
    <>
      <span className="min-w-0 truncate text-label font-medium">{item.title}</span>
      <span className="tnum shrink-0 text-meta opacity-80">{hoursLabel(item.hours)}</span>
    </>
  )
  const props = {
    className,
    style: { height, borderLeftColor: courseColor(item.course_name) },
    'aria-label': `${item.title}, ${item.hours} hours, ${s.label.toLowerCase()}`,
  }
  return onSelect ? (
    <button type="button" {...props} aria-pressed={selected} onClick={() => onSelect(item.assignment_id)}>
      {content}
    </button>
  ) : (
    <div {...props}>{content}</div>
  )
}
