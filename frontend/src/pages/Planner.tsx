import { useEffect, useRef, useState } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { Link } from 'react-router-dom'
import ListView from '../components/plan/ListView'
import MonthGrid from '../components/plan/MonthGrid'
import WeekGrid from '../components/plan/WeekGrid'
import { useAuth } from '../auth/AuthContext'
import { useShell } from '../components/shell/AppShell'
import PageHeader, { PAGE_X } from '../components/shell/PageHeader'
import TopBar from '../components/shell/TopBar'
import { Alert, Button, Icon, IconButton, Loading, Skeleton, Spinner } from '../components/ui'
import { useShortcuts } from '../hooks/useShortcuts'
import type { Assignment } from '../api/types'
import { CAL_VIEWS, hoursLabel, kyivDate, rangeTitle, relative, shiftView, VIEW_LABEL, type CalView } from '../lib/dates'

const SHORTCUT: Record<CalView, string> = { day: 'D', '3day': '3', week: 'W', month: 'M' }

export default function Planner() {
  usePageMeta('Planner')
  const s = useShell()
  const { user } = useAuth()
  const { view } = s
  const calendar = view !== 'list'
  const title = rangeTitle(view, s.date)

  const goToday = () => s.setDate(s.today)
  const shift = (n: number) => s.setDate(shiftView(view, s.date, n))

  useShortcuts({
    t: goToday,
    ArrowLeft: () => calendar && shift(-1),
    ArrowRight: () => calendar && shift(1),
    d: () => s.setView('day'),
    3: () => s.setView('3day'),
    w: () => s.setView('week'),
    m: () => s.setView('month'),
    l: () => s.setView('list'),
    n: () => s.openAssignment('new'),
  })

  const plan = s.plan
  const atRisk = user?.show_at_risk === false ? [] : plan?.assignments.filter((a) => !a.done && a.window.at_risk) ?? []

  const tabs: { calendar: boolean; label: string; icon: 'calendar' | 'list'; key: string }[] = [
    { calendar: true, label: 'Calendar', icon: 'calendar', key: SHORTCUT[s.calView] },
    { calendar: false, label: 'List', icon: 'list', key: 'L' },
  ]

  // Range picker (Notion Calendar puts it top right).
  const picker = calendar && (
    <label className="relative flex items-center">
      <span className="sr-only">Range</span>
      <select
        value={view}
        onChange={(e) => s.setView(e.target.value as CalView)}
        className="h-7 appearance-none rounded bg-bg pl-2 pr-7 text-body font-medium text-text shadow-btn hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        {CAL_VIEWS.map((v) => (
          <option key={v} value={v}>{VIEW_LABEL[v]}</option>
        ))}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2 text-text-3" />
    </label>
  )

  return (
    <>
      <TopBar icon="calendar" crumbs={['Planner', calendar ? title : 'All assignments']} right={picker} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader icon="calendar" title="Planner" description="When to start each assignment — not just when it’s due." />

        {/* Notion database view bar: view tabs left, blue New right */}
        <div className={`${PAGE_X} mt-6`}>
          <div className="relative flex h-10 items-center gap-1 border-b border-line">
            <div role="tablist" aria-label="View" className="flex h-full items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  aria-selected={calendar === t.calendar}
                  title={`${t.label} (${t.key})`}
                  onClick={() => s.setView(t.calendar ? s.calView : 'list')}
                  className={`relative flex h-full items-center gap-1.5 px-1 text-body font-medium after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 ${
                    calendar === t.calendar ? 'text-text after:bg-text' : 'text-text-2 hover:text-text'
                  }`}
                >
                  <span className="flex h-7 items-center gap-1.5 rounded px-1.5 hover:bg-bg-hover">
                    <Icon name={t.icon} />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {s.aiProgress && (
                <span role="status" className="tnum flex items-center gap-1.5 px-2 text-meta text-text-2" title="AI is estimating hours for new assignments">
                  <Spinner small />
                  <span className="hidden sm:inline">AI estimating</span> {s.aiProgress.done}/{s.aiProgress.total}
                </span>
              )}
              {plan && atRisk.length > 0 && <AtRisk items={atRisk} today={plan.today} onSelect={s.openAssignment} />}
              <Button size="sm" onClick={() => s.openAssignment('new')} title="New assignment (N)" aria-label="New assignment">
                <Icon name="plus" />
                New
              </Button>
            </div>
          </div>

          {calendar && (
            <div className="flex h-12 items-center gap-1">
              <h2 className="mr-auto truncate text-body font-semibold">{title}</h2>
              <IconButton label={`Previous ${VIEW_LABEL[view].toLowerCase()} (←)`} onClick={() => shift(-1)}><Icon name="chevron-left" /></IconButton>
              <Button variant="ghost" size="sm" onClick={goToday} title="Today (T)">Today</Button>
              <IconButton label={`Next ${VIEW_LABEL[view].toLowerCase()} (→)`} onClick={() => shift(1)}><Icon name="chevron-right" /></IconButton>
            </div>
          )}
        </div>

        {s.error && (
          <div className={`${PAGE_X} py-3`}>
            <Alert>
              {s.error}{' '}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => void s.reload()}>Try again</button>
            </Alert>
          </div>
        )}

        {!plan ? (
          !s.error && <PlanSkeleton slow={s.slow} />
        ) : plan.assignments.length === 0 ? (
          <EmptyState onNew={() => s.openAssignment('new')} />
        ) : (
          <>
            <div className={`${PAGE_X} flex flex-1 flex-col ${calendar ? '' : 'pt-2'}`}>
              {view === 'month' ? (
                <MonthGrid
                  month={s.date}
                  days={plan.days}
                  assignments={plan.assignments}
                  today={plan.today}
                  hidden={s.hidden}
                  onSelect={s.openAssignment}
                  onPickDay={(d) => s.setView('day', d)}
                />
              ) : calendar ? (
                <WeekGrid
                  days={plan.days}
                  assignments={plan.assignments}
                  today={plan.today}
                  selectedId={s.selectedId}
                  hidden={s.hidden}
                  onSelect={s.openAssignment}
                />
              ) : (
                <ListView assignments={plan.assignments} today={plan.today} selectedId={s.selectedId} hidden={s.hidden} onSelect={s.openAssignment} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Compact "won't fit" indicator in the view bar (planner §4 v2 at_risk items); the list opens in a small popover.
 * Can be turned off in Settings ("Warn about late work").
 */
function AtRisk({ items, today, onSelect }: { items: Assignment[]; today: string; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const n = items.length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${n} assignment${n === 1 ? '' : 's'} won’t fit before the deadline`}
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded px-2 text-body text-text-2 hover:bg-bg-hover hover:text-text"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-critical" />
        <span className="tnum font-medium text-text">{n}</span>
        <span className="hidden sm:inline">won’t fit</span>
        <Icon name="chevron-down" className="text-text-3" />
      </button>
      {open && (
        <div role="dialog" aria-label="Assignments that won’t fit" className="absolute right-0 top-10 z-30 w-80 max-w-full rounded-md bg-bg p-1 shadow-pop">
          <p className="px-2 pb-1.5 pt-2 text-meta text-text-2">
            Not enough study hours before these deadlines. Open one to lower its estimate or mark it done, or add hours in{' '}
            <Link to="/app/settings" className="font-medium text-text underline underline-offset-2">Settings</Link>.
          </p>
          <ul className="max-h-80 overflow-y-auto">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onSelect(a.id)
                  }}
                  className="flex w-full min-w-0 flex-col rounded px-2 py-1.5 text-left hover:bg-bg-hover"
                >
                  <span className="truncate text-body">{a.title}</span>
                  <span className="tnum text-meta text-text-2">
                    {hoursLabel(a.window.shortfall_hours)} short · due {relative(kyivDate(a.deadline), today)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className={`${PAGE_X} py-20 text-center`}>
      <div>
        <p className="text-section font-semibold">No assignments yet</p>
        <p className="mt-1 text-body text-text-2">Add one yourself or bring in every deadline from Moodle at once.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onNew}><Icon name="plus" />Add assignment</Button>
          <Link to="/app/import"><Button variant="secondary"><Icon name="upload" />Import Moodle calendar</Button></Link>
        </div>
      </div>
    </div>
  )
}

function PlanSkeleton({ slow }: { slow: boolean }) {
  return (
    <div className={PAGE_X}>
      <div className="grid grid-cols-3 border-t border-line md:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`space-y-1 border-line p-1 ${i ? 'border-l' : ''} ${i > 2 ? 'hidden md:block' : ''}`}>
            <Skeleton className="mb-3 h-6 w-14" />
            <Skeleton className={i % 2 ? 'h-14' : 'h-8'} />
            <Skeleton className={i % 3 ? 'h-7' : 'h-12'} />
          </div>
        ))}
      </div>
      <Loading slow={slow} />
    </div>
  )
}
