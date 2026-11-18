import type { DayItem } from '../../api/types'
import { hoursLabel } from '../../lib/dates'
import { STATUS } from '../../lib/status'
import StatusDot from './StatusDot'

/** The core answer: what to work on today, with hours and status. */
export default function TodayList({ items, onSelect }: { items: DayItem[]; onSelect: (id: number) => void }) {
  const total = items.reduce((sum, it) => sum + it.hours, 0)
  return (
    <section aria-labelledby="today-heading">
      <h2 id="today-heading" className="flex items-center justify-between px-2 pb-1 text-meta font-medium text-text-2">
        <span>Today</span>
        {total > 0 && <span className="tnum">{hoursLabel(total)}</span>}
      </h2>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-meta text-text-3">Nothing planned for today.</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it.assignment_id}>
              <button
                type="button"
                onClick={() => onSelect(it.assignment_id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-label hover:bg-bg-hover"
              >
                <StatusDot status={it.status} label={false} />
                <span className="tnum w-7 shrink-0 text-meta text-text-2">{hoursLabel(it.hours)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                <span className={`shrink-0 text-tiny ${STATUS[it.status].text}`}>{STATUS[it.status].label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
