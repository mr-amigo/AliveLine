import { useEffect, useRef } from 'react'
import type { Assignment, Day } from '../../api/types'
import { dayNum, hoursLabel, kyivDate, mediumDay, weekday, weekdayIndex } from '../../lib/dates'
import { courseKey } from '../../lib/status'
import DeadlineChip from './DeadlineChip'
import WorkBlock, { HOUR_PX } from './WorkBlock'

const MAX_CHIPS = 2

interface Props {
  days: Day[]
  assignments: Assignment[]
  capacity: number
  today: string
  selectedId?: number | null
  hidden?: Set<string>
  onSelect?: (id: number) => void
}

/**
 * Seven day columns: header, deadline row, stacked work blocks (no hour rows — we plan hours per day).
 * Under 768px it becomes a horizontally swipeable 3-day view (scroll-snap).
 */
export default function WeekGrid({ days, assignments, capacity, today, selectedId = null, hidden, onSelect }: Props) {
  const visible = (course: string | null) => !hidden?.has(courseKey(course))
  const dueByDay = new Map<string, Assignment[]>()
  for (const a of assignments) {
    if (!visible(a.course_name)) continue
    const d = kyivDate(a.deadline)
    dueByDay.set(d, [...(dueByDay.get(d) ?? []), a])
  }
  const bodyMin = capacity * HOUR_PX + 24
  const scroller = useRef<HTMLDivElement>(null)
  const todayHeader = useRef<HTMLDivElement>(null)

  // 3-day mobile view: open on today, not Monday.
  useEffect(() => {
    const el = scroller.current
    if (el && todayHeader.current && el.scrollWidth > el.clientWidth) el.scrollLeft = todayHeader.current.offsetLeft
  }, [days[0]?.date, today]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={scroller} className="relative flex-1 snap-x snap-mandatory overflow-x-auto md:overflow-x-visible">
      <div
        role="list"
        aria-label="Week plan"
        className="grid h-full grid-cols-[repeat(7,minmax(calc((100vw-2rem)/3),1fr))] grid-rows-[auto_auto_1fr] md:grid-cols-7"
      >
        {days.map((day, i) => {
          const isToday = day.date === today
          const past = day.date < today
          const weekend = weekdayIndex(day.date) >= 5
          const items = day.items.filter((it) => visible(it.course_name))
          const due = dueByDay.get(day.date) ?? []
          const planned = items.reduce((sum, it) => sum + it.hours, 0)
          const col = { gridColumn: i + 1 }
          const sep = i > 0 ? 'border-l border-line' : ''
          return (
            <div role="listitem" key={day.date} className="contents" aria-label={`${mediumDay(day.date)}, ${hoursLabel(planned)} planned`}>
              <div
                ref={isToday ? todayHeader : undefined}
                style={col}
                className={`row-start-1 flex snap-start items-center gap-1.5 border-b border-line px-2 py-1.5 text-meta font-medium ${sep} ${
                  isToday ? 'bg-accent-tint text-text' : weekend ? 'text-text-3' : 'text-text-2'
                }`}
              >
                <span>{weekday(day.date)}</span>
                <span
                  aria-current={isToday ? 'date' : undefined}
                  className={`tnum grid h-6 min-w-6 place-items-center rounded-full px-1 ${isToday ? 'bg-accent font-semibold text-white' : ''}`}
                >
                  {dayNum(day.date)}
                </span>
              </div>

              <div style={col} className={`row-start-2 flex min-h-8 min-w-0 flex-col gap-0.5 border-b border-line p-1 ${sep}`}>
                {due.slice(0, MAX_CHIPS).map((a) => (
                  <DeadlineChip key={a.id} a={a} onSelect={onSelect} />
                ))}
                {due.length > MAX_CHIPS && (
                  <span className="px-1 text-tiny font-medium text-text-2" title={due.slice(MAX_CHIPS).map((a) => a.title).join('\n')}>
                    +{due.length - MAX_CHIPS} more
                  </span>
                )}
              </div>

              <div style={{ ...col, minHeight: bodyMin }} className={`relative row-start-3 flex min-w-0 flex-col gap-[2px] p-1 ${sep}`}>
                {items.map((it) => (
                  <WorkBlock key={it.assignment_id} item={it} past={past} selected={it.assignment_id === selectedId} onSelect={onSelect} />
                ))}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
                  style={{ top: 4 + capacity * HOUR_PX }}
                >
                  {i === 0 && <span className="absolute right-1 top-0.5 text-tiny text-text-3">{hoursLabel(capacity)} / day</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
