import { NavLink, useNavigate } from 'react-router-dom'
import type { Plan } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { kyivDate, mondayOf } from '../../lib/dates'
import { courseColor, courseKey } from '../../lib/status'
import TodayList from '../plan/TodayList'
import { Icon, IconButton, Skeleton, type IconName } from '../ui'
import MiniMonth from './MiniMonth'
import { rowClass, SidebarSection } from './SidebarSection'

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
  { to: '/app/import', label: 'Import', icon: 'upload' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ plan, today, week, hidden, onToggleCourse, onSelect, onClose }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const deadlines = new Set(plan?.assignments.filter((a) => !a.done).map((a) => kyivDate(a.deadline)))
  const courses = [...new Set(plan?.assignments.map((a) => a.course_name))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  )
  const name = user?.name.trim() || 'My'

  function pick(date: string) {
    navigate(`/app?week=${mondayOf(date)}`)
    onClose?.()
  }

  return (
    <nav aria-label="Sidebar" className="flex h-full w-full flex-col overflow-y-auto bg-bg-subtle px-2 pb-2 text-text-sidebar">
      {/* Workspace switcher row */}
      <div className="flex h-12 shrink-0 items-center gap-1">
        <div className={`${rowClass} min-w-0 flex-1 text-text`} title={user ? `${user.name} · ${user.email}` : undefined}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-text text-tiny font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{name}’s AliveLine</span>
        </div>
        {onClose && (
          <IconButton label="Close menu" onClick={onClose}>
            <Icon name="chevrons-right" className="rotate-180" />
          </IconButton>
        )}
      </div>

      <div className="space-y-px">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            onClick={onClose}
            className={({ isActive }) => `${rowClass} ${isActive ? 'bg-bg-hover text-text' : 'hover:bg-bg-hover'}`}
          >
            <Icon name={l.icon} className="text-text-3" />
            {l.label}
          </NavLink>
        ))}
      </div>

      <div className="mt-4">
        <MiniMonth today={today} week={week} deadlines={deadlines} onPick={pick} />
      </div>

      <div className="mt-3">
        {plan ? (
          <TodayList
            items={plan.today_items.filter((it) => !hidden.has(courseKey(it.course_name)))}
            onSelect={(id) => {
              onSelect(id)
              onClose?.()
            }}
          />
        ) : (
          <div className="space-y-1.5 px-2 pt-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
        )}
      </div>

      {courses.length > 0 && (
        <div className="mt-3">
          <SidebarSection title="Courses">
            <ul className="space-y-px">
              {courses.map((c) => {
                const key = courseKey(c)
                const shown = !hidden.has(key)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={shown}
                      title={shown ? 'Hide from plan' : 'Show in plan'}
                      onClick={() => onToggleCourse(key)}
                      className={`${rowClass} hover:bg-bg-hover`}
                    >
                      <span
                        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border-[1.5px]"
                        style={{ borderColor: courseColor(c), background: shown ? courseColor(c) : 'transparent' }}
                      >
                        {shown && <Icon name="check" className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className={`truncate ${shown ? '' : 'text-text-3'}`}>{c ?? 'No course'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </SidebarSection>
        </div>
      )}

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
          className={`${rowClass} hover:bg-bg-hover`}
        >
          <Icon name="logout" className="text-text-3" />
          Log out
        </button>
      </div>
    </nav>
  )
}
