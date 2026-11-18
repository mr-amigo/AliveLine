import { useEffect, useState } from 'react'
import { addDays, dayNum, firstOfMonth, mediumDay, monthGrid, monthName, year } from '../../lib/dates'
import { Icon, IconButton } from '../ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Month picker: click a date → jump to it in the current view; visible range shaded; dots mark deadlines; today = red circle (Notion Calendar). */
export default function MiniMonth({
  today,
  range,
  highlight,
  deadlines,
  onPick,
}: {
  today: string
  range: { from: string; days: number }
  highlight: boolean
  deadlines: Set<string>
  onPick: (date: string) => void
}) {
  const anchor = firstOfMonth(addDays(range.from, Math.floor((range.days - 1) / 2)))
  const [month, setMonth] = useState(anchor)
  useEffect(() => setMonth(anchor), [anchor])
  const end = addDays(range.from, range.days - 1)
  const shaded = (d: string) => highlight && d >= range.from && d <= end

  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 10))
  }
  const cells = monthGrid(month)
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7))

  return (
    <div className="px-1 text-text">
      <div className="mb-1 flex items-center justify-between pl-1">
        <span className="text-body font-medium text-text">
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
            <tr key={row[0]}>
              {row.map((d, i) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7)
                const isToday = d === today
                return (
                  <td
                    key={d}
                    className={`p-0 ${
                      shaded(d)
                        ? `bg-bg-hover ${i === 0 || !shaded(row[i - 1]) ? 'rounded-l' : ''} ${i === 6 || !shaded(row[i + 1]) ? 'rounded-r' : ''}`
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(d)}
                      aria-label={`${mediumDay(d)}${deadlines.has(d) ? ', has deadlines' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      className="relative mx-auto grid h-7 w-7 place-items-center rounded-full hover:bg-bg-hover"
                    >
                      <span
                        className={`tnum grid h-5 w-5 place-items-center rounded-full ${
                          isToday ? 'bg-today font-semibold text-white' : inMonth ? 'text-text' : 'text-text-3'
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
