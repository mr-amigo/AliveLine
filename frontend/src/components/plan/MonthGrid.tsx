import type { Assignment, Day, Status } from '../../api/types'
import { addDays, daysBetween, daysInMonth, dayNum, firstOfMonth, hoursLabel, kyivDate, mediumDay, mondayOf, weekday, weekdayIndex } from '../../lib/dates'
import { courseKey, STATUS, STATUS_ORDER } from '../../lib/status'
import DeadlineChip from './DeadlineChip'

const MAX_CHIPS = 2

interface Props {
  /** Any date in the month shown. */
  month: string
  /** Plan days of that month (load bars); cells outside it show deadlines only. */
  days: Day[]
  assignments: Assignment[]
  today: string
  hidden?: Set<string>
  onSelect?: (id: number) => void
  /** Click on a date number → open that day. */
  onPickDay: (date: string) => void
}

/** Month view: deadlines + a daily load bar (planned hours vs that day's capacity) per cell. */
export default function MonthGrid({ month, days, assignments, today, hidden, onSelect, onPickDay }: Props) {
  const visible = (course: string | null) => !hidden?.has(courseKey(course))
  const first = firstOfMonth(month)
  const start = mondayOf(first)
  const last = addDays(first, daysInMonth(first) - 1)
  const weeks = Math.ceil((daysBetween(start, last) + 1) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  const byDate = new Map(days.map((d) => [d.date, d]))
  const dueByDay = new Map<string, Assignment[]>()
  for (const a of assignments) {
    if (!visible(a.course_name)) continue
    const d = kyivDate(a.deadline)
    dueByDay.set(d, [...(dueByDay.get(d) ?? []), a])
  }

  return (
    <div className="border-t border-line">
      <div aria-hidden="true" className="grid grid-cols-7">
        {cells.slice(0, 7).map((d, i) => (
          <div key={d} className={`h-8 px-2 pt-1.5 text-meta text-text-2 ${i ? 'border-l border-line' : ''}`}>
            {weekday(d)}
          </div>
        ))}
      </div>
      <div role="list" aria-label="Month plan" className="grid grid-cols-7 border-t border-line">
        {cells.map((date, i) => {
          const inMonth = date.slice(0, 7) === first.slice(0, 7)
          const isToday = date === today
          const day = byDate.get(date)
          const items = day?.items.filter((it) => visible(it.course_name)) ?? []
          const planned = items.reduce((sum, it) => sum + it.hours, 0)
          const due = dueByDay.get(date) ?? []
          const worst = STATUS_ORDER.find((st) => items.some((it) => it.status === st)) as Status | undefined
          const fill = day && day.capacity > 0 ? Math.min(1, planned / day.capacity) : planned > 0 ? 1 : 0
          return (
            <div
              role="listitem"
              key={date}
              aria-label={`${mediumDay(date)}: ${hoursLabel(planned)} planned, ${due.length} due`}
              className={`flex min-h-20 min-w-0 flex-col gap-1 border-line p-1 md:min-h-28 ${i % 7 ? 'border-l' : ''} ${
                i >= 7 ? 'border-t' : ''
              } ${weekdayIndex(date) >= 5 ? 'bg-bg-weekend' : ''}`}
            >
              <button
                type="button"
                onClick={() => onPickDay(date)}
                title={`Open ${mediumDay(date)}`}
                aria-current={isToday ? 'date' : undefined}
                className={`tnum grid h-6 min-w-6 place-items-center self-start rounded-full px-1 text-body hover:bg-bg-hover ${
                  isToday ? 'bg-today font-semibold text-white hover:bg-today' : inMonth ? 'text-text' : 'text-text-3'
                }`}
              >
                {dayNum(date)}
              </button>

              {planned > 0 && worst && (
                <div className="flex items-center gap-1 px-0.5" title={`${hoursLabel(planned)} of ${hoursLabel(day?.capacity ?? 0)} planned`}>
                  <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-hover">
                    <span className={`block h-full rounded-full ${STATUS[worst].dot}`} style={{ width: `${fill * 100}%` }} />
                  </span>
                  <span className="tnum shrink-0 text-tiny text-text-2">{hoursLabel(planned)}</span>
                </div>
              )}

              {/* Deadlines: chips from md up, dots on phones */}
              <div className="hidden min-w-0 flex-col gap-1 md:flex">
                {due.slice(0, MAX_CHIPS).map((a) => (
                  <DeadlineChip key={a.id} a={a} onSelect={onSelect} />
                ))}
                {due.length > MAX_CHIPS && (
                  <button type="button" onClick={() => onPickDay(date)} className="self-start px-1 text-meta text-text-2 hover:text-text">
                    +{due.length - MAX_CHIPS} more
                  </button>
                )}
              </div>
              {due.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPickDay(date)}
                  aria-label={`${due.length} due on ${mediumDay(date)}`}
                  className="flex flex-wrap gap-0.5 px-1 md:hidden"
                >
                  {due.slice(0, 4).map((a) => (
                    <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${STATUS[a.window.status].dot}`} />
                  ))}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
