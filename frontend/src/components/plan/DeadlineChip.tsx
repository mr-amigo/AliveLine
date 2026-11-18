import type { Assignment } from '../../api/types'
import { kyivTime } from '../../lib/dates'
import { STATUS } from '../../lib/status'

/** All-day-row chip marking a deadline (DESIGN.md §5). At-risk items are listed once above the grid, not here. */
export default function DeadlineChip({ a, onSelect }: { a: Assignment; onSelect?: (id: number) => void }) {
  const s = STATUS[a.window.status]
  const label = `${a.title}, due ${kyivTime(a.deadline)}, ${s.label.toLowerCase()}${a.window.at_risk ? ", won't make it" : ''}`
  const chip = (
    <span className={`flex h-[22px] min-w-0 items-center gap-1 rounded bg-bg px-1.5 text-meta font-medium text-text shadow-card`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      <span className="truncate">{a.title}</span>
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
