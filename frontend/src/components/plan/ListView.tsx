import { useState } from 'react'
import type { Assignment, Status } from '../../api/types'
import { hoursLabel, kyivDate, relative, shortDay } from '../../lib/dates'
import { courseKey, courseTag, STATUS, STATUS_ORDER } from '../../lib/status'
import { Icon, Tag, type IconName } from '../ui'

// Notion table columns: Name · Status · Course · Start · Due · Hours. Widths hide progressively on small screens.
const COLS: { label: string; icon: IconName; className: string }[] = [
  { label: 'Name', icon: 'text', className: 'min-w-0 flex-1' },
  { label: 'Status', icon: 'status', className: 'hidden w-36 sm:flex' },
  { label: 'Course', icon: 'tag', className: 'hidden w-44 md:flex' },
  { label: 'Start', icon: 'calendar', className: 'hidden w-24 lg:flex' },
  { label: 'Due', icon: 'calendar', className: 'w-24' },
  { label: 'Hours', icon: 'clock', className: 'w-20 justify-end' },
]
const cell = 'flex h-full shrink-0 items-center gap-1.5 px-2 border-l border-line first:border-l-0'

/** Notion table grouped by status: Critical → Time to start → Can wait → Done (collapsed). Mobile default view. */
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
    <div className="pb-24 text-body">
      <div role="row" className="flex h-[34px] border-y border-line text-text-2">
        {COLS.map((c) => (
          <span key={c.label} role="columnheader" className={`${cell} ${c.className}`}>
            <Icon name={c.icon} className="text-text-3" />
            {c.label}
          </span>
        ))}
      </div>

      {STATUS_ORDER.map((status) => {
        const list = groups.get(status)!
        if (!list.length) return null
        const collapsed = status === 'done' && !showDone
        const s = STATUS[status]
        return (
          <section key={status} aria-label={s.label} className="pt-5">
            <h2 className="flex h-[34px] items-center gap-2">
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded text-text-3 hover:bg-bg-hover"
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? 'Show' : 'Hide'} ${s.label}`}
                onClick={() => status === 'done' && setShowDone(!showDone)}
                disabled={status !== 'done'}
              >
                <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} className="h-3 w-3" />
              </button>
              <Tag className={`${s.tint} ${s.text}`}>{s.label}</Tag>
              <span className="tnum text-text-3">{list.length}</span>
            </h2>
            {!collapsed && (
              <ul className="border-t border-line">
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
  const s = STATUS[a.window.status]
  const values = [
    <span className={`truncate font-medium ${a.done ? 'text-text-3 line-through' : ''}`}>{a.title}</span>,
    <Tag className={`${s.tint} ${s.text}`}>{s.label}</Tag>,
    a.course_name ? <Tag style={courseTag(a.course_name)}>{a.course_name}</Tag> : null,
    !a.done ? <span className="tnum truncate">{start <= today ? 'Today' : shortDay(start)}</span> : null,
    <span className="tnum truncate" title={relative(due, today)}>{shortDay(due)}</span>,
    <span className="tnum">{hoursLabel(a.effective_hours)}</span>,
  ]
  return (
    <button
      type="button"
      onClick={() => onSelect(a.id)}
      aria-label={`${a.title}, ${s.label}, due ${shortDay(due)}`}
      className={`flex h-[34px] w-full border-b border-line text-left transition-colors duration-[120ms] hover:bg-bg-hover/50 ${selected ? 'bg-select' : ''}`}
    >
      {COLS.map((c, i) => (
        <span key={c.label} className={`${cell} ${c.className}`}>{values[i]}</span>
      ))}
    </button>
  )
}
