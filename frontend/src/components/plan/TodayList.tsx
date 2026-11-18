import type { DayItem } from '../../api/types'
import { hoursLabel } from '../../lib/dates'
import { STATUS } from '../../lib/status'
import { rowClass, SidebarSection } from '../shell/SidebarSection'
import StatusDot from './StatusDot'

/** The core answer: what to work on today, with hours and status. */
export default function TodayList({ items, onSelect }: { items: DayItem[]; onSelect: (id: number) => void }) {
  const total = items.reduce((sum, it) => sum + it.hours, 0)
  return (
    <SidebarSection title="Today" aside={total > 0 && <span className="tnum">{hoursLabel(total)}</span>}>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-body text-text-3">Nothing planned for today.</p>
      ) : (
        <ul className="space-y-px">
          {items.map((it) => (
            <li key={it.assignment_id}>
              <button
                type="button"
                onClick={() => onSelect(it.assignment_id)}
                title={`${it.title} · ${STATUS[it.status].label}`}
                className={`${rowClass} hover:bg-bg-hover`}
              >
                <StatusDot status={it.status} />
                <span className="min-w-0 flex-1 truncate">{it.title}</span>
                <span className="tnum shrink-0 text-meta font-normal text-text-3">{hoursLabel(it.hours)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SidebarSection>
  )
}
