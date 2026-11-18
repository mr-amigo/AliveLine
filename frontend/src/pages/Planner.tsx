import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ListView from '../components/plan/ListView'
import WeekGrid from '../components/plan/WeekGrid'
import { useShell } from '../components/shell/AppShell'
import PageHeader, { PAGE_X } from '../components/shell/PageHeader'
import TopBar from '../components/shell/TopBar'
import { Alert, Button, Icon, IconButton, Loading, Skeleton } from '../components/ui'
import { useShortcuts } from '../hooks/useShortcuts'
import type { Assignment } from '../api/types'
import { addDays, hoursLabel, kyivDate, mondayOf, relative, weekTitle } from '../lib/dates'

type View = 'week' | 'list'
const isMobile = () => window.matchMedia('(max-width: 767px)').matches

export default function Planner() {
  const s = useShell()
  const [params, setParams] = useSearchParams()
  const view: View = (params.get('view') as View | null) ?? (isMobile() ? 'list' : 'week')

  function setView(v: View) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', v)
      return next
    })
  }

  const goToday = () => s.setWeek(mondayOf(s.today))
  const shift = (n: number) => s.setWeek(addDays(s.week, n * 7))

  useShortcuts({
    t: goToday,
    ArrowLeft: () => view === 'week' && shift(-1),
    ArrowRight: () => view === 'week' && shift(1),
    w: () => setView('week'),
    l: () => setView('list'),
    n: () => s.openAssignment('new'),
  })

  const plan = s.plan
  const atRisk = plan?.assignments.filter((a) => !a.done && a.window.at_risk) ?? []

  const tabs: { v: View; label: string; icon: 'calendar' | 'list'; key: string }[] = [
    { v: 'week', label: 'Week', icon: 'calendar', key: 'W' },
    { v: 'list', label: 'List', icon: 'list', key: 'L' },
  ]

  return (
    <>
      <TopBar icon="🗓️" crumbs={['Planner', view === 'week' ? weekTitle(s.week) : 'All assignments']} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader icon="🗓️" title="Planner" description="When to start each assignment — not just when it’s due." />

        {/* Notion database view bar: view tabs left, actions + blue New right */}
        <div className={`${PAGE_X} mt-6`}>
          <div className="flex h-10 items-center gap-1 border-b border-line">
            <div role="tablist" aria-label="View" className="flex h-full items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  role="tab"
                  aria-selected={view === t.v}
                  title={`${t.label} (${t.key})`}
                  onClick={() => setView(t.v)}
                  className={`relative flex h-full items-center gap-1.5 px-1 text-body font-medium after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 ${
                    view === t.v ? 'text-text after:bg-text' : 'text-text-2 hover:text-text'
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
              <Button size="sm" onClick={() => s.openAssignment('new')} title="New assignment (N)" aria-label="New assignment">
                <Icon name="plus" />
                New
              </Button>
            </div>
          </div>

          {view === 'week' && (
            <div className="flex h-12 items-center gap-1">
              <h2 className="mr-auto text-body font-semibold">{weekTitle(s.week)}</h2>
              <IconButton label="Previous week (←)" onClick={() => shift(-1)}><Icon name="chevron-left" /></IconButton>
              <Button variant="ghost" size="sm" onClick={goToday} title="Today (T)">Today</Button>
              <IconButton label="Next week (→)" onClick={() => shift(1)}><Icon name="chevron-right" /></IconButton>
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
            {atRisk.length > 0 && (
              <div className={`${PAGE_X} pb-3 ${view === 'list' ? 'pt-4' : ''}`}>
                <AtRisk items={atRisk} today={plan.today} onSelect={s.openAssignment} />
              </div>
            )}
            <div className={`${PAGE_X} flex flex-1 flex-col ${view === 'list' ? 'pt-2' : ''}`}>
              {view === 'week' ? (
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

const AT_RISK_SHOWN = 3

/** One callout for everything the plan can't fit (planner §4 v2): the most urgent first, the rest folded. */
function AtRisk({ items, today, onSelect }: { items: Assignment[]; today: string; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.slice(0, AT_RISK_SHOWN)
  const n = items.length
  return (
    <Alert>
      <p>
        <strong className="font-semibold">
          {n} assignment{n === 1 ? '' : 's'} won’t be finished in time
        </strong>{' '}
        <span className="text-text-2">
          — the plan covers what’s due first. Open one to lower its estimate or mark it done, or add study hours in{' '}
          <Link to="/app/settings" className="font-medium text-text underline underline-offset-2">Settings</Link>.
        </span>
      </p>
      <ul className="mt-2 space-y-0.5">
        {shown.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className="flex w-full min-w-0 items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-bg-hover"
            >
              <span className="truncate font-medium">{a.title}</span>
              <span className="tnum shrink-0 text-meta text-text-2">
                {hoursLabel(a.window.shortfall_hours)} short · due {relative(kyivDate(a.deadline), today)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {n > AT_RISK_SHOWN && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 px-1 text-meta font-medium text-text-2 hover:text-text">
          {open ? 'Show less' : `Show ${n - AT_RISK_SHOWN} more`}
        </button>
      )}
    </Alert>
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
