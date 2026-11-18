import type { Assignment } from '../../api/types'
import { hoursLabel, kyivTime } from '../../lib/dates'
import { STATUS } from '../../lib/status'
import { Icon } from '../ui'

/** All-day-row chip marking a deadline; shows unscheduled hours in red (DESIGN.md §5). */
export default function DeadlineChip({ a, onSelect }: { a: Assignment; onSelect?: (id: number) => void }) {
  const s = STATUS[a.window.status]
  const short = a.window.unscheduled_hours
  const label = `${a.title}, due ${kyivTime(a.deadline)}, ${s.label.toLowerCase()}${short ? `, ${short} hours don't fit` : ''}`
  const chip = (
    <>
      <span className={`flex h-5 min-w-0 items-center gap-1 rounded px-1.5 text-meta font-medium ${s.tint} ${s.text}`}>
        <Icon name="flag" className="h-3 w-3" />
        <span className="truncate">{a.title}</span>
      </span>
      {short > 0 && (
        <span className="flex items-center gap-1 px-0.5 text-tiny font-medium text-critical-text">
          <Icon name="alert" className="h-3 w-3" />
          <span className="truncate">{hoursLabel(short)} unscheduled</span>
        </span>
      )}
    </>
  )
  return onSelect ? (
    <button type="button" title={label} aria-label={label} onClick={() => onSelect(a.id)} className="flex min-w-0 flex-col gap-0.5 rounded text-left">
      {chip}
    </button>
  ) : (
    <div title={label} className="flex min-w-0 flex-col gap-0.5">{chip}</div>
  )
}
