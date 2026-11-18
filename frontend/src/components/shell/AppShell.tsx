import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useOutletContext, useSearchParams } from 'react-router-dom'
import { usePlan, type PlanState } from '../../hooks/usePlan'
import { isValidDate, mondayOf, todayKyiv } from '../../lib/dates'
import AssignmentDrawer from '../assignment/AssignmentDrawer'
import Sidebar from './Sidebar'

export interface ShellContext extends PlanState {
  today: string
  week: string
  setWeek: (monday: string) => void
  selectedId: number | null
  openAssignment: (id: number | 'new') => void
  hidden: Set<string>
  openMenu: () => void
}

export const useShell = () => useOutletContext<ShellContext>()

const HIDDEN_KEY = 'al_hidden_courses'

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** `/app/*` layout: sidebar + page + assignment drawer. State lives in the URL (`week`, `view`, `a`). */
export default function AppShell() {
  const [params, setParams] = useSearchParams()
  const clientToday = todayKyiv()
  const weekParam = params.get('week')
  const week = isValidDate(weekParam) ? mondayOf(weekParam) : mondayOf(clientToday)
  const planState = usePlan(week)
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

  const setWeek = useCallback((monday: string) => setParam('week', monday === mondayOf(today) ? null : monday), [setParam, today])
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

  const sidebarProps = { plan, today, week, hidden, onToggleCourse: toggleCourse, onSelect: openAssignment }
  const ctx: ShellContext = {
    ...planState,
    today,
    week,
    setWeek,
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
