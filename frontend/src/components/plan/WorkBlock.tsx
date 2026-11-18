import type { DayItem } from '../../api/types'
import { hoursLabel } from '../../lib/dates'
import { courseColor, STATUS } from '../../lib/status'

export const HOUR_PX = 32
/** Room for a two-line title (DESIGN.md §5): short sessions are taller than their hours. */
const MIN_PX = 40

/** A day's slice of work on one assignment; height ∝ hours, min 40px (DESIGN.md §5). */
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
  const height = Math.max(MIN_PX, item.hours * HOUR_PX - 2)
  const stacked = height >= 56 // title (2 lines) above the hours line
  const stepLine = !!item.step_title && height >= 72 // step gets its own line
  const className = `relative flex w-full min-w-0 overflow-hidden rounded border-l-[3px] px-1.5 py-1 text-left ${s.tint} ${
    s.text
  } ${selected ? `ring-1 ${s.ring}` : ''} ${past ? 'opacity-60' : ''} ${
    stacked ? 'flex-col' : 'items-start gap-1'
  } transition-shadow duration-[120ms] hover:shadow-[inset_0_0_0_999px_rgba(55,53,47,0.06)] active:shadow-[inset_0_0_0_999px_rgba(55,53,47,0.12)]`
  const step = item.step_title && !stepLine && <span className="font-normal"> · {item.step_title}</span>
  const content = (
    <>
      <span className="line-clamp-2 min-w-0 flex-1 break-words text-meta font-medium leading-4">
        {item.title}
        {!stacked && step}
      </span>
      {stepLine && <span className="min-w-0 truncate text-meta leading-4">{item.step_title}</span>}
      <span className={`tnum min-w-0 shrink-0 truncate text-meta leading-4 opacity-70 ${stacked ? 'mt-auto' : ''}`}>
        {hoursLabel(item.hours)}
        {stacked && step}
      </span>
    </>
  )
  const props = {
    className,
    style: { height, borderLeftColor: courseColor(item.course_name) },
    'aria-label': `${item.title}${item.step_title ? `, step: ${item.step_title}` : ''}, ${item.hours} hours, ${s.label.toLowerCase()}`,
  }
  return onSelect ? (
    <button type="button" {...props} aria-pressed={selected} onClick={() => onSelect(item.assignment_id)}>
      {content}
    </button>
  ) : (
    <div {...props}>{content}</div>
  )
}
