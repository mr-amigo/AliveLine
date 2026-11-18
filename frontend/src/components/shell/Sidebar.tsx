import { NavLink, useNavigate } from 'react-router-dom'
import type { Plan } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { kyivDate, mondayOf } from '../../lib/dates'
import { courseColor, courseKey } from '../../lib/status'
import Logo from '../Logo'
import TodayList from '../plan/TodayList'
import { Icon, IconButton, Skeleton, type IconName } from '../ui'
import MiniMonth from './MiniMonth'

interface Props {
  plan: Plan | null
  today: string
  week: string
  hidden: Set<string>
  onToggleCourse: (key: string) => void
  onSelect: (id: number) => void
  onClose?: () => void
}

const links: { to: string; label: string; icon: IconName }[] = [
  { to: '/app', label: 'Planner', icon: 'calendar' },
  { to: '/app/import', label: 'Import .ics', icon: 'upload' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ plan, today, week, hidden, onToggleCourse, onSelect, onClose }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const deadlines = new Set(plan?.assignments.filter((a) => !a.done).map((a) => kyivDate(a.deadline)))
  const courses = [...new Set(plan?.assignments.map((a) => a.course_name))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  )

  function pick(date: string) {
    navigate(`/app?week=${mondayOf(date)}`)
    onClose?.()
  }

  return (
    <nav aria-label="Sidebar" className="flex h-full w-full flex-col gap-5 overflow-y-auto bg-bg-subtle px-2 py-3">
      <div className="flex items-center justify-between px-2">
        <Logo to="/app" />
        <span className="flex items-center gap-1">
          <span
            title={user ? `${user.name} · ${user.email}` : undefined}
            className="grid h-6 w-6 place-items-center rounded-full bg-line-strong text-tiny font-semibold text-text"
          >
            {user?.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          {onClose && (
            <IconButton label="Close menu" onClick={onClose}>
              <Icon name="x" />
            </IconButton>
          )}
        </span>
      </div>

      <MiniMonth today={today} week={week} deadlines={deadlines} onPick={pick} />

      {plan ? (
        <TodayList items={plan.today_items.filter((it) => !hidden.has(courseKey(it.course_name)))} onSelect={(id) => { onSelect(id); onClose?.() }} />
      ) : (
        <div className="space-y-1.5 px-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
      )}

      {courses.length > 0 && (
        <section aria-labelledby="courses-heading">
          <h2 id="courses-heading" className="px-2 pb-1 text-meta font-medium text-text-2">Courses</h2>
          <ul>
            {courses.map((name) => {
              const key = courseKey(name)
              const shown = !hidden.has(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={shown}
                    title={shown ? 'Hide from plan' : 'Show in plan'}
                    onClick={() => onToggleCourse(key)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-label hover:bg-bg-hover"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm border-2"
                      style={{ borderColor: courseColor(name), background: shown ? courseColor(name) : 'transparent' }}
                    />
                    <span className={`truncate ${shown ? '' : 'text-text-3'}`}>{name ?? 'No course'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="mt-auto border-t border-line pt-2">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded px-2 py-1.5 text-label font-medium ${isActive ? 'bg-accent-tint text-text' : 'text-text-2 hover:bg-bg-hover hover:text-text'}`
            }
          >
            <Icon name={l.icon} />
            {l.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={async () => { await signOut(); navigate('/', { replace: true }) }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-label font-medium text-text-2 hover:bg-bg-hover hover:text-text"
        >
          <Icon name="logout" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
