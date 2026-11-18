import { Link, useSearchParams } from 'react-router-dom'
import ListView from '../components/plan/ListView'
import WeekGrid from '../components/plan/WeekGrid'
import { useShell } from '../components/shell/AppShell'
import TopBar from '../components/shell/TopBar'
import { Alert, Button, Icon, IconButton, Loading, Skeleton } from '../components/ui'
import { useShortcuts } from '../hooks/useShortcuts'
import { addDays, hoursLabel, mondayOf, weekTitle } from '../lib/dates'

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
  const unscheduled = plan?.assignments.filter((a) => !a.done).reduce((sum, a) => sum + a.window.unscheduled_hours, 0) ?? 0

  return (
    <>
      <TopBar
        title={view === 'week' ? weekTitle(s.week) : 'All assignments'}
        titleOnMobile={view !== 'week'}
        left={
          view === 'week' && (
            <>
              <Button variant="secondary" size="sm" onClick={goToday} title="Today (T)">Today</Button>
              <IconButton label="Previous week (←)" onClick={() => shift(-1)}><Icon name="chevron-left" /></IconButton>
              <IconButton label="Next week (→)" onClick={() => shift(1)}><Icon name="chevron-right" /></IconButton>
            </>
          )
        }
        right={
          <>
            <div role="group" aria-label="View" className="flex h-7 rounded border border-line-strong p-0.5">
              {(['week', 'list'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  title={`${v === 'week' ? 'Week' : 'List'} (${v === 'week' ? 'W' : 'L'})`}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-1 rounded-sm px-2 text-meta font-medium ${view === v ? 'bg-bg-hover text-text' : 'text-text-2 hover:text-text'}`}
                >
                  <Icon name={v === 'week' ? 'calendar' : 'list'} className="md:hidden" />
                  <span className="hidden md:inline">{v === 'week' ? 'Week' : 'List'}</span>
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => s.openAssignment('new')} title="New assignment (N)" aria-label="New assignment">
              <Icon name="plus" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col overflow-y-auto">
        {s.error && (
          <div className="p-3">
            <Alert>
              <span className="flex-1">{s.error}</span>
              <button type="button" className="font-medium underline" onClick={() => void s.reload()}>Try again</button>
            </Alert>
          </div>
        )}

        {!plan ? (
          !s.error && <PlanSkeleton slow={s.slow} />
        ) : plan.assignments.length === 0 ? (
          <EmptyState onNew={() => s.openAssignment('new')} />
        ) : (
          <>
            {unscheduled > 0 && (
              <div className="border-b border-line bg-critical-tint px-4 py-2 text-label text-critical-text" role="status">
                <span className="inline-flex items-start gap-2">
                  <Icon name="alert" className="mt-0.5" />
                  <span>
                    <strong className="tnum font-semibold">{hoursLabel(unscheduled)}</strong> don't fit before their deadlines — raise daily
                    hours in{' '}
                    <Link to="/app/settings" className="font-medium underline underline-offset-2">Settings</Link> or correct estimates.
                  </span>
                </span>
              </div>
            )}
            {view === 'week' ? (
              <WeekGrid
                days={plan.days}
                assignments={plan.assignments}
                capacity={plan.capacity}
                today={plan.today}
                selectedId={s.selectedId}
                hidden={s.hidden}
                onSelect={s.openAssignment}
              />
            ) : (
              <ListView assignments={plan.assignments} today={plan.today} selectedId={s.selectedId} hidden={s.hidden} onSelect={s.openAssignment} />
            )}
          </>
        )}
      </div>
    </>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center px-4 py-24 text-center">
      <div>
        <p className="text-section font-semibold">No assignments yet</p>
        <p className="mt-1 text-label text-text-2">Add one yourself or bring in every deadline from Moodle at once.</p>
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
    <div>
      <div className="grid grid-cols-3 md:grid-cols-7">
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
