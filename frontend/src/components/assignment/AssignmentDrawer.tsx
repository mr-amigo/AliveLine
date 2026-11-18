import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { aiApi, ApiError, assignmentsApi } from '../../api/client'
import type { Assignment, AssignmentUpdate, Estimate } from '../../api/types'
import { addDays, hoursLabel, kyivDate, kyivTime, kyivToUtcIso, mediumDay, relative, shortDay } from '../../lib/dates'
import { STATUS } from '../../lib/status'
import { Alert, Button, Icon, IconButton, Tag, useToast, type IconName } from '../ui'
import EstimatePanel, { type EstimateOrigin } from './EstimatePanel'

interface Props {
  assignment?: Assignment
  courses: string[]
  today: string
  onClose: () => void
  onOpen: (id: number) => void
  onChanged: () => Promise<void>
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong')

/** Notion side peek (bottom sheet on mobile) to create or edit one assignment (DESIGN.md §5). */
export default function AssignmentDrawer({ assignment: a, courses, today, onClose, onOpen, onChanged }: Props) {
  const toast = useToast()
  const panel = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(a?.title ?? '')
  const [course, setCourse] = useState(a?.course_name ?? '')
  const [date, setDate] = useState(a ? kyivDate(a.deadline) : addDays(today, 7))
  const [time, setTime] = useState(a ? kyivTime(a.deadline) : '23:59')
  const [description, setDescription] = useState(a?.description ?? '')
  const [userHours, setUserHours] = useState<number | null>(a?.user_hours ?? null)
  const [pending, setPending] = useState<Estimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [busy, setBusy] = useState<'save' | 'done' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const aiHours = pending?.hours ?? a?.ai_hours ?? null
  const aiIsAi = (pending?.source ?? a?.estimate_source) === 'ai'
  const hours = userHours ?? pending?.hours ?? a?.ai_hours ?? a?.effective_hours ?? null
  const origin: EstimateOrigin | null =
    userHours !== null ? 'you' : pending ? pending.source : a ? (a.estimate_source === 'ai' ? 'ai' : 'heuristic') : null
  const rationale = pending?.rationale ?? a?.ai_rationale ?? null

  const deadlineIso = date && time ? kyivToUtcIso(date, time) : null
  // Minute precision: imported deadlines may carry seconds the time input can't show.
  const deadlineChanged = !a || date !== kyivDate(a.deadline) || time !== kyivTime(a.deadline)
  const dirty =
    !a ||
    title !== a.title ||
    description !== a.description ||
    course !== (a.course_name ?? '') ||
    deadlineChanged ||
    userHours !== a.user_hours ||
    pending !== null
  const canSave = dirty && title.trim() !== '' && deadlineIso !== null && busy === null

  // Focus the title on open, give focus back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (a) panel.current?.focus()
    else titleRef.current?.focus()
    return () => previous?.focus?.()
  }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes even when focus is on the grid behind the drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (confirmDelete) setConfirmDelete(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDelete, onClose])

  async function requestEstimate(): Promise<Estimate | null> {
    try {
      const e = await aiApi.estimate({ title: title.trim(), description, course_name: course.trim() || null })
      return { ...e, rationale: e.rationale.slice(0, 500) }
    } catch (err) {
      toast(`Estimate failed: ${errText(err)}`, 'error')
      return null
    }
  }

  async function reestimate() {
    setEstimating(true)
    const e = await requestEstimate()
    setEstimating(false)
    if (e) {
      setPending(e)
      setUserHours(null)
    }
  }

  async function save() {
    if (!canSave || !deadlineIso) return
    setBusy('save')
    try {
      const base = { title: title.trim(), description, deadline: deadlineIso }
      if (!a) {
        let estimate = pending
        if (userHours === null && !estimate) {
          setEstimating(true)
          estimate = await requestEstimate() // null → server uses its rule-based estimate
          setEstimating(false)
        }
        const created = await assignmentsApi.create({
          ...base,
          course_name: course.trim() || null,
          ...(userHours !== null ? { user_hours: userHours } : {}),
          ...(estimate ? { estimate } : {}),
        })
        await onChanged()
        toast('Assignment added')
        onOpen(created.id)
      } else {
        const body: AssignmentUpdate = { title: base.title, description, course_name: course.trim() }
        if (deadlineChanged) body.deadline = deadlineIso
        if (userHours !== a.user_hours) body.user_hours = userHours
        if (pending) body.estimate = pending
        const saved = await assignmentsApi.update(a.id, body)
        // Mirror what the server stored (it trims text), so the form isn't left "dirty".
        setTitle(saved.title)
        setDescription(saved.description)
        setCourse(saved.course_name ?? '')
        setUserHours(saved.user_hours)
        setPending(null)
        await onChanged()
        toast('Saved')
      }
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(null)
      setEstimating(false)
    }
  }

  async function toggleDone() {
    if (!a) return
    setBusy('done')
    try {
      await assignmentsApi.update(a.id, { done: !a.done })
      await onChanged()
      toast(a.done ? 'Reopened' : 'Marked done')
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!a) return
    setBusy('delete')
    try {
      await assignmentsApi.remove(a.id)
      await onChanged()
      toast('Deleted')
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
      setBusy(null)
    }
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void save()
    } else if (e.key === 'Tab' && panel.current) {
      // Focus trap: cycle within the drawer.
      const nodes = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, [tabindex="0"]')
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const w = a?.window
  const propInput =
    'h-[34px] min-w-0 rounded bg-transparent px-2 text-body text-text outline-none transition-colors duration-[120ms] placeholder:text-text-3 hover:bg-bg-hover focus:bg-bg focus:shadow-focus'
  return (
    <>
      <div className="animate-fade fixed inset-0 z-30 bg-black/20 md:hidden" onClick={onClose} aria-hidden="true" />
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="animate-sheet fixed inset-x-0 bottom-0 z-30 flex h-[90vh] flex-col rounded-t-xl bg-bg shadow-pop outline-none
          md:animate-drawer md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[520px] md:rounded-none md:shadow-peek"
      >
        <header className="flex h-11 shrink-0 items-center gap-1 px-3">
          <IconButton label="Close (Esc)" onClick={onClose}><Icon name="chevrons-right" /></IconButton>
          <span id="drawer-title" className="ml-1 text-body text-text-2">{a ? 'Assignment' : 'New assignment'}</span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-10 pt-6 md:px-12">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Untitled assignment"
            aria-label="Title"
            className={`w-full bg-transparent text-h1 font-bold tracking-[-0.01em] outline-none placeholder:text-[rgba(55,53,47,0.2)] ${a?.done ? 'text-text-2 line-through' : ''}`}
          />

          <dl className="mt-5 space-y-px">
            {w && (
              <Property icon="status" label="Status">
                <div className="flex min-h-[34px] flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1">
                  <Tag className={`${STATUS[w.status].tint} ${STATUS[w.status].text}`}>{STATUS[w.status].label}</Tag>
                  {!a.done && (
                    <span className="tnum text-text-2">
                      start {w.start_date <= today ? 'today' : shortDay(w.start_date)} → finish {shortDay(w.target_finish)}
                    </span>
                  )}
                </div>
              </Property>
            )}
            <Property icon="tag" label="Course" htmlFor="drawer-course">
              <input id="drawer-course" list="course-options" value={course} onChange={(e) => setCourse(e.target.value)} maxLength={100} placeholder="Empty" className={`${propInput} w-full`} />
              <datalist id="course-options">{courses.map((c) => <option key={c} value={c} />)}</datalist>
            </Property>
            <Property icon="calendar" label="Due" htmlFor="drawer-date">
              <div className="flex flex-wrap items-center">
                <input id="drawer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={propInput} />
                <input type="time" aria-label="Time (Kyiv)" value={time} onChange={(e) => setTime(e.target.value)} required className={propInput} />
                {date && <span className="px-2 text-meta text-text-3">{mediumDay(date)}, {relative(date, today)}</span>}
              </div>
            </Property>
            {a && (
              <Property icon="link" label="Source">
                <span className="flex h-[34px] items-center px-2 text-text-2">{a.source === 'manual' ? 'Added by you' : 'Moodle calendar'}</span>
              </Property>
            )}
          </dl>

          <div className="mt-4 space-y-2">
            {w?.at_risk && (
              <Alert>
                Won’t make it: {hoursLabel(w.shortfall_hours)} of this don’t fit before the deadline. Lower the estimate, or add study hours
                in Settings.
              </Alert>
            )}
            <EstimatePanel
              hours={hours}
              origin={origin}
              rationale={rationale}
              aiHours={aiHours}
              aiIsAi={aiIsAi}
              estimating={estimating}
              canEstimate={title.trim() !== '' && busy === null}
              onHours={setUserHours}
              onEstimate={reestimate}
              onUseAi={() => setUserHours(null)}
            />
            {a && dirty && <p className="text-meta text-text-3">Save to update the plan.</p>}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              aria-label="Description"
              placeholder="Paste the task text here — the AI estimate reads it…"
              className="min-h-48 w-full resize-none bg-transparent text-section leading-[1.5] outline-none placeholder:text-text-3"
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-12">
          {confirmDelete ? (
            <>
              <span className="text-body text-text-2">Delete this assignment?</span>
              <Button variant="danger" className="ml-auto" onClick={remove} loading={busy === 'delete'}>Delete</Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={save} disabled={!canSave} loading={busy === 'save'} title={`Save (${isMac ? '⌘' : 'Ctrl'}+Enter)`}>
                {a ? 'Save' : estimating ? 'Estimating…' : 'Add assignment'}
                <span className="hidden text-tiny opacity-70 md:inline">{isMac ? '⌘' : 'Ctrl'}↵</span>
              </Button>
              {a && (
                <>
                  <Button variant="secondary" onClick={toggleDone} loading={busy === 'done'}>
                    {!busy && <Icon name="check" />}
                    {a.done ? 'Reopen' : 'Mark done'}
                  </Button>
                  <IconButton label="Delete" className="ml-auto hover:bg-callout-red hover:text-critical" onClick={() => setConfirmDelete(true)}>
                    <Icon name="trash" />
                  </IconButton>
                </>
              )}
            </>
          )}
        </footer>
      </section>
    </>
  )
}

/** Notion page property: grey icon + label column, editable value on the right. */
function Property({ icon, label, htmlFor, children }: { icon: IconName; label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex items-start">
      <dt className="flex h-[34px] w-32 shrink-0 items-center gap-1.5 px-1.5 text-body text-text-2 sm:w-40">
        <Icon name={icon} className="text-text-3" />
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}
