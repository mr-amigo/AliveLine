import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import ListView from '../components/plan/ListView'
import MonthGrid from '../components/plan/MonthGrid'
import WeekGrid from '../components/plan/WeekGrid'
import { useShell } from '../components/shell/AppShell'
import PageHeader, { PAGE_X } from '../components/shell/PageHeader'
import TopBar from '../components/shell/TopBar'
import { Alert, Button, Icon, IconButton, Loading, Skeleton } from '../components/ui'
import { useShortcuts } from '../hooks/useShortcuts'
import type { Assignment } from '../api/types'
import { AI_CAP, estimateWithAi, needsAi } from '../lib/aiPass'
import { CAL_VIEWS, hoursLabel, kyivDate, rangeTitle, relative, shiftView, VIEW_LABEL, type CalView } from '../lib/dates'

const SHORTCUT: Record<CalView, string> = { day: 'D', '3day': '3', week: 'W', month: 'M' }

export default function Planner() {
  const s = useShell()
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
  const atRisk = plan?.assignments.filter((a) => !a.done && a.window.at_risk) ?? []
  const rough = plan?.assignments.filter(needsAi) ?? []

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
        <PageHeader title="Planner" description="When to start each assignment — not just when it’s due." />

        {/* Notion database view bar: view tabs left, blue New right */}
        <div className={`${PAGE_X} mt-6`}>
          <div className="flex h-10 items-center gap-1 border-b border-line">
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
            {(atRisk.length > 0 || rough.length > 0) && (
              <div className={`${PAGE_X} space-y-2 pb-3 ${calendar ? '' : 'pt-4'}`}>
                {atRisk.length > 0 && <AtRisk items={atRisk} today={plan.today} onSelect={s.openAssignment} />}
                {rough.length > 0 && <RoughEstimates items={rough} onDone={s.reload} />}
              </div>
            )}
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

/** Items still on the rule-based estimate (e.g. imported before the AI pass ran): one button runs AI over all of them. */
function RoughEstimates({ items, onDone }: { items: Assignment[]; onDone: () => Promise<void> }) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const total = Math.min(items.length, AI_CAP)
  const n = items.length

  async function run() {
    setError(null)
    setProgress(0)
    try {
      const estimated = await estimateWithAi(items, setProgress)
      if (estimated < total) setError(`AI couldn’t estimate ${total - estimated} of them. Open one to set hours yourself.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'AI estimates stopped')
    }
    await onDone()
    setProgress(null)
  }

  return (
    <Alert kind="info" icon={<Icon name="sparkle" />}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1">
          <strong className="font-semibold">
            {n} rough estimate{n === 1 ? '' : 's'}
          </strong>{' '}
          <span className="text-text-2">
            {progress === null ? '— guessed from the title only. AI reads the whole task and gets closer.' : `— estimating ${progress} / ${total}…`}
          </span>
        </p>
        <Button variant="secondary" size="sm" className="bg-transparent" loading={progress !== null} onClick={() => void run()}>
          Estimate all with AI
        </Button>
      </div>
      {error && <p className="mt-1 text-text-2">{error}</p>}
    </Alert>
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
