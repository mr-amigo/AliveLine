import { useState } from 'react'
import type { Assignment, Status } from '../../api/types'
import { hoursLabel, kyivDate, relative, shortDay } from '../../lib/dates'
import { courseColor, courseKey, STATUS, STATUS_ORDER } from '../../lib/status'
import { Icon } from '../ui'
import StatusDot from './StatusDot'

/** Assignments grouped Critical → Time to start → Can wait → Done (collapsed). Mobile default view. */
export default function ListView({
  assignments,
  today,
  selectedId,
  hidden,
  onSelect,
}: {
  assignments: Assignment[]
  today: string
  selectedId: number | null
  hidden: Set<string>
  onSelect: (id: number) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const groups = new Map<Status, Assignment[]>(STATUS_ORDER.map((s) => [s, []]))
  for (const a of assignments) if (!hidden.has(courseKey(a.course_name))) groups.get(a.window.status)!.push(a)
  for (const list of groups.values())
    list.sort((x, y) => x.window.start_date.localeCompare(y.window.start_date) || x.deadline.localeCompare(y.deadline))

  return (
    <div className="pb-16">
      {STATUS_ORDER.map((status) => {
        const list = groups.get(status)!
        if (!list.length) return null
        const collapsed = status === 'done' && !showDone
        return (
          <section key={status} aria-label={STATUS[status].label}>
            <h2 className="flex h-9 items-center gap-2 border-b border-line px-4 text-label font-medium">
              {status === 'done' ? (
                <button type="button" className="flex items-center gap-2" aria-expanded={!collapsed} onClick={() => setShowDone(!showDone)}>
                  <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} className="text-text-2" />
                  {STATUS[status].label}
                </button>
              ) : (
                <>
                  <StatusDot status={status} label={false} />
                  {STATUS[status].label}
                </>
              )}
              <span className="tnum text-meta text-text-3">{list.length}</span>
            </h2>
            {!collapsed && (
              <ul>
                {list.map((a) => (
                  <li key={a.id}>
                    <Row a={a} today={today} selected={a.id === selectedId} onSelect={onSelect} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Row({ a, today, selected, onSelect }: { a: Assignment; today: string; selected: boolean; onSelect: (id: number) => void }) {
  const due = kyivDate(a.deadline)
  const start = a.window.start_date
  return (
    <button
      type="button"
      onClick={() => onSelect(a.id)}
      className={`flex h-10 w-full items-center gap-3 border-b border-line px-4 text-left text-label transition-colors duration-[120ms] hover:bg-bg-subtle ${
        selected ? 'bg-bg-subtle' : ''
      }`}
    >
      <StatusDot status={a.window.status} />
      <span className={`min-w-0 flex-1 truncate font-medium ${a.done ? 'text-text-3 line-through' : ''}`}>{a.title}</span>
      {a.course_name && (
        <span className="hidden w-40 shrink-0 items-center gap-1.5 truncate text-meta text-text-2 md:flex">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: courseColor(a.course_name) }} />
          <span className="truncate">{a.course_name}</span>
        </span>
      )}
      {!a.done && (
        <span className="tnum hidden w-24 shrink-0 text-meta text-text-2 sm:block">
          start {start <= today ? 'today' : shortDay(start)}
        </span>
      )}
      <span className="tnum w-24 shrink-0 text-meta text-text-2" title={relative(due, today)}>due {shortDay(due)}</span>
      <span className="tnum w-10 shrink-0 text-right text-meta text-text-2">{hoursLabel(a.effective_hours)}</span>
    </button>
  )
}
