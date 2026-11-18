import { useEffect, useState } from 'react'
import { addDays, dayNum, mediumDay, monthGrid, monthName, mondayOf, year } from '../../lib/dates'
import { Icon, IconButton } from '../ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Month picker: click a date → jump to its week; dots mark deadlines; today = accent circle. */
export default function MiniMonth({
  today,
  week,
  deadlines,
  onPick,
}: {
  today: string
  week: string
  deadlines: Set<string>
  onPick: (date: string) => void
}) {
  const anchor = (w: string) => `${addDays(w, 3).slice(0, 8)}01`
  const [month, setMonth] = useState(anchor(week))
  useEffect(() => setMonth(anchor(week)), [week])

  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 10))
  }
  const cells = monthGrid(month)
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7))

  return (
    <div className="px-1">
      <div className="mb-1 flex items-center justify-between pl-1">
        <span className="text-label font-semibold">
          {monthName(month)} {year(month)}
        </span>
        <span className="flex">
          <IconButton label="Previous month" onClick={() => shift(-1)}><Icon name="chevron-left" /></IconButton>
          <IconButton label="Next month" onClick={() => shift(1)}><Icon name="chevron-right" /></IconButton>
        </span>
      </div>
      <table className="w-full table-fixed border-collapse text-center text-tiny">
        <thead>
          <tr className="text-text-3">
            {WEEKDAYS.map((d, i) => <th key={i} className="h-6 font-medium">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className={mondayOf(row[0]) === week ? 'bg-bg-hover' : ''}>
              {row.map((d, i) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7)
                const isToday = d === today
                return (
                  <td key={d} className={`p-0 ${i === 0 ? 'rounded-l' : ''} ${i === 6 ? 'rounded-r' : ''}`}>
                    <button
                      type="button"
                      onClick={() => onPick(d)}
                      aria-label={`${mediumDay(d)}${deadlines.has(d) ? ', has deadlines' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      className="relative mx-auto grid h-7 w-7 place-items-center rounded-full hover:bg-line"
                    >
                      <span
                        className={`tnum grid h-5 w-5 place-items-center rounded-full ${
                          isToday ? 'bg-accent font-semibold text-white' : inMonth ? 'text-text' : 'text-text-3'
                        }`}
                      >
                        {dayNum(d)}
                      </span>
                      {deadlines.has(d) && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-text-2" />}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
