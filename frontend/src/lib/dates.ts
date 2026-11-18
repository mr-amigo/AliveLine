// Calendar-day math. Plan dates are 'YYYY-MM-DD' strings (APP_TZ = Europe/Kyiv on the server);
// they are handled as UTC midnights so the browser's own zone never shifts a day.

export const TZ = 'Europe/Kyiv'
const DAY_MS = 86_400_000

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const kyivParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function partsInKyiv(instant: Date): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of kyivParts.formatToParts(instant)) if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out
}

/** Today's calendar date in Kyiv. */
export function todayKyiv(): string {
  const p = partsInKyiv(new Date())
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Calendar date ('YYYY-MM-DD') of an ISO instant, in Kyiv. */
export function kyivDate(iso: string): string {
  const p = partsInKyiv(new Date(iso))
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Wall-clock time ('HH:mm') of an ISO instant, in Kyiv. */
export function kyivTime(iso: string): string {
  const p = partsInKyiv(new Date(iso))
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Kyiv wall-clock date + time → UTC ISO string (handles DST). */
export function kyivToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  const offset = (instant: number) => {
    const p = partsInKyiv(new Date(instant))
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant
  }
  const first = wall - offset(wall)
  return new Date(wall - offset(first)).toISOString()
}

export function addDays(date: string, n: number): string {
  return toIso(new Date(toUtc(date).getTime() + n * DAY_MS))
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS)
}

export function mondayOf(date: string): string {
  const dow = (toUtc(date).getUTCDay() + 6) % 7 // Mon = 0
  return addDays(date, -dow)
}

export function weekdayIndex(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7
}

export function isValidDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime())
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts })
const weekdayFmt = fmt({ weekday: 'short' })
const monthFmt = fmt({ month: 'long' })
const monthShortFmt = fmt({ month: 'short' })

export const weekday = (date: string) => weekdayFmt.format(toUtc(date))
export const dayNum = (date: string) => toUtc(date).getUTCDate()
export const monthName = (date: string) => monthFmt.format(toUtc(date))
export const year = (date: string) => toUtc(date).getUTCFullYear()

/** "Tue 17" */
export const shortDay = (date: string) => `${weekday(date)} ${dayNum(date)}`

/** "Tue 17 Nov" */
export const mediumDay = (date: string) => `${shortDay(date)} ${monthShortFmt.format(toUtc(date))}`

/** "November 2026" ("Nov 2026" short) or "Nov – Dec 2026" for a week spanning two months. */
export function weekTitle(monday: string, short = false): string {
  const sunday = addDays(monday, 6)
  if (monthName(monday) === monthName(sunday))
    return `${short ? monthShortFmt.format(toUtc(monday)) : monthName(monday)} ${year(sunday)}`
  const a = monthShortFmt.format(toUtc(monday))
  const b = monthShortFmt.format(toUtc(sunday))
  return year(monday) === year(sunday) ? `${a} – ${b} ${year(sunday)}` : `${a} ${year(monday)} – ${b} ${year(sunday)}`
}

/** "today", "tomorrow", "in 3 days", "2 days ago". */
export function relative(date: string, today: string): string {
  const n = daysBetween(today, date)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

/** 6×7 grid of dates for the month containing `date`, starting on Monday. */
export function monthGrid(date: string): string[] {
  const first = `${date.slice(0, 8)}01`
  const start = mondayOf(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** "2h", "1.5h" */
export const hoursLabel = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`

// ---- Calendar views (DESIGN.md §5): which days each view fetches and shows ----

export type CalView = 'day' | '3day' | 'week' | 'month'
export type View = CalView | 'list'
export const CAL_VIEWS: CalView[] = ['day', '3day', 'week', 'month']
export const VIEW_LABEL: Record<View, string> = { day: 'Day', '3day': '3 days', week: 'Week', month: 'Month', list: 'List' }
export const isView = (v: string | null): v is View => v === 'list' || CAL_VIEWS.includes(v as CalView)

export const firstOfMonth = (date: string) => `${date.slice(0, 8)}01`

export function addMonths(date: string, n: number): string {
  const [y, m] = date.split('-').map(Number)
  return toIso(new Date(Date.UTC(y, m - 1 + n, 1)))
}

export const daysInMonth = (date: string) => daysBetween(firstOfMonth(date), addMonths(date, 1))

/** Days `/plan` is asked for. Month = only its own days (API max 31); list = the week (it shows every assignment anyway). */
export function viewRange(view: View, date: string): { from: string; days: number } {
  if (view === 'day') return { from: date, days: 1 }
  if (view === '3day') return { from: date, days: 3 }
  if (view === 'month') return { from: firstOfMonth(date), days: daysInMonth(date) }
  return { from: mondayOf(date), days: 7 }
}

/** The anchor date after moving `n` periods of `view`. */
export function shiftView(view: View, date: string, n: number): string {
  if (view === 'month') return addMonths(date, n)
  return addDays(date, n * (view === 'day' ? 1 : view === '3day' ? 3 : 7))
}

/** "Wed 18 Nov 2026" · "18 – 20 Nov 2026" · "November 2026" (week, month). */
export function rangeTitle(view: View, date: string): string {
  if (view === 'day') return `${mediumDay(date)} ${year(date)}`
  if (view === '3day') {
    const end = addDays(date, 2)
    const m = (d: string) => monthShortFmt.format(toUtc(d))
    const head = m(date) === m(end) ? `${dayNum(date)}` : year(date) === year(end) ? `${dayNum(date)} ${m(date)}` : `${dayNum(date)} ${m(date)} ${year(date)}`
    return `${head} – ${dayNum(end)} ${m(end)} ${year(end)}`
  }
  if (view === 'month') return `${monthName(date)} ${year(date)}`
  return weekTitle(mondayOf(date))
}
