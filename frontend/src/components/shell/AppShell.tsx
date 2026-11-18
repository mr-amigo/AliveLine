import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useOutletContext, useSearchParams } from 'react-router-dom'
import { usePlan, type PlanState } from '../../hooks/usePlan'
import { isValidDate, isView, todayKyiv, viewRange, type CalView, type View } from '../../lib/dates'
import AssignmentDrawer from '../assignment/AssignmentDrawer'
import Sidebar from './Sidebar'

export interface ShellContext extends PlanState {
  today: string
  view: View
  /** Anchor date of the visible range ('YYYY-MM-DD'). */
  date: string
  range: { from: string; days: number }
  /** Last calendar range used (for the Calendar tab and mini-month picks). */
  calView: CalView
  /** Switch view; optional `date` moves the range in the same URL update. */
  setView: (v: View, date?: string) => void
  setDate: (date: string) => void
  selectedId: number | null
  openAssignment: (id: number | 'new') => void
  hidden: Set<string>
  openMenu: () => void
}

export const useShell = () => useOutletContext<ShellContext>()

const HIDDEN_KEY = 'al_hidden_courses'
const CAL_VIEW_KEY = 'al_cal_view'
const isMobile = () => window.matchMedia('(max-width: 767px)').matches

function loadCalView(): CalView {
  try {
    const v = localStorage.getItem(CAL_VIEW_KEY)
    return isView(v) && v !== 'list' ? v : 'week'
  } catch {
    return 'week'
  }
}

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** `/app/*` layout: sidebar + page + assignment drawer. State lives in the URL (`view`, `date`, `a`). */
export default function AppShell() {
  const [params, setParams] = useSearchParams()
  const clientToday = todayKyiv()
  const [calView, setCalView] = useState(loadCalView)
  const viewParam = params.get('view')
  const view: View = isView(viewParam) ? viewParam : isMobile() ? 'list' : calView
  const dateParam = params.get('date')
  const date = isValidDate(dateParam) ? dateParam : clientToday
  const range = viewRange(view, date)
  const planState = usePlan(range.from, range.days)
  const { plan, reload } = planState
  const today = plan?.today ?? clientToday

  const [hidden, setHidden] = useState(loadHidden)
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleCourse = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const setParam = useCallback(
    (key: string, value: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      }),
    [setParams],
  )

  const setDate = useCallback((d: string) => setParam('date', d === today ? null : d), [setParam, today])
  const setView = useCallback(
    (v: View, d?: string) => {
      if (v !== 'list') {
        setCalView(v)
        try {
          localStorage.setItem(CAL_VIEW_KEY, v)
        } catch {
          /* private mode: just don't remember */
        }
      }
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('view', v)
        if (d !== undefined) {
          if (d === today) next.delete('date')
          else next.set('date', d)
        }
        return next
      })
    },
    [setParams, today],
  )
  const openAssignment = useCallback((id: number | 'new') => setParam('a', String(id)), [setParam])
  const closeDrawer = useCallback(() => setParam('a', null), [setParam])

  const a = params.get('a')
  const drawerId: number | 'new' | null = a === 'new' ? 'new' : a && /^\d+$/.test(a) ? Number(a) : null
  const assignment = typeof drawerId === 'number' ? plan?.assignments.find((x) => x.id === drawerId) : undefined
  const missing = typeof drawerId === 'number' && plan !== null && !assignment && !planState.loading

  useEffect(() => {
    if (missing) closeDrawer()
  }, [missing, closeDrawer])

  const courses = useMemo(
    () => [...new Set(plan?.assignments.map((x) => x.course_name).filter((c): c is string => !!c))].sort(),
    [plan],
  )

  const sidebarProps = { plan, today, view, range, calView, hidden, onToggleCourse: toggleCourse, onSelect: openAssignment }
  const ctx: ShellContext = {
    ...planState,
    today,
    view,
    date,
    range,
    calView,
    setView,
    setDate,
    selectedId: typeof drawerId === 'number' ? drawerId : null,
    openAssignment,
    hidden,
    openMenu: () => setMenuOpen(true),
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 shadow-[inset_-1px_0_0_rgba(15,15,15,0.04)] lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="animate-fade absolute inset-0 bg-black/20" onClick={() => setMenuOpen(false)} />
          <div className="animate-drawer relative h-full w-72 max-w-[85vw] shadow-pop">
            <Sidebar {...sidebarProps} onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={ctx} />
      </main>

      {drawerId !== null && (drawerId === 'new' || assignment) && (
        <AssignmentDrawer
          key={drawerId}
          assignment={drawerId === 'new' ? undefined : assignment}
          courses={courses}
          today={today}
          onClose={closeDrawer}
          onOpen={openAssignment}
          onChanged={reload}
        />
      )}
    </div>
  )
}
