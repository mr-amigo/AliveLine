import type { Assignment } from '../../api/types'
import { kyivTime } from '../../lib/dates'
import { STATUS } from '../../lib/status'

/** All-day-row chip marking a deadline, always one line. At-risk items are listed once above the grid. */
export default function DeadlineChip({ a, showTime = false, onSelect }: { a: Assignment; showTime?: boolean; onSelect?: (id: number) => void }) {
  const s = STATUS[a.window.status]
  const label = `${a.title}, due ${kyivTime(a.deadline)}, ${s.label.toLowerCase()}${a.window.at_risk ? ", won't make it" : ''}`
  const chip = (
    <span className="flex h-[22px] min-w-0 items-center gap-1 whitespace-nowrap rounded bg-bg px-1.5 text-meta font-medium text-text shadow-card">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      <span className="min-w-0 flex-1 truncate">{a.title}</span>
      {showTime && <span className="tnum shrink-0 font-normal text-text-2">{kyivTime(a.deadline)}</span>}
    </span>
  )
  return onSelect ? (
    <button type="button" title={label} aria-label={label} onClick={() => onSelect(a.id)} className="flex min-w-0 flex-col rounded text-left">
      {chip}
    </button>
  ) : (
    <div title={label} className="flex min-w-0 flex-col">{chip}</div>
  )
}
