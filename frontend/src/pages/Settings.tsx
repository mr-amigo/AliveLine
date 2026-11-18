import { useState, type FormEvent, type ReactNode } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { ApiError, settingsApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useShell } from '../components/shell/AppShell'
import PageHeader, { NARROW } from '../components/shell/PageHeader'
import PlanSection from '../components/PlanSection'
import TopBar from '../components/shell/TopBar'
import { Button, Input, Stepper, useToast } from '../components/ui'
import { hoursLabel } from '../lib/dates'

function Row({ label, hint, htmlFor, children }: { label: string; hint: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-body text-text">{label}</label>
        <p className="text-meta text-text-2">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Settings() {
  usePageMeta('Settings')
  const { user, setUser } = useAuth()
  const { reload } = useShell()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [capacity, setCapacity] = useState(user?.daily_capacity_hours ?? 3)
  const [buffer, setBuffer] = useState(user?.buffer_days ?? 1)
  const [weekdays, setWeekdays] = useState<number[] | null>(user?.weekday_hours ?? null)
  const [session, setSession] = useState(user?.max_session_hours ?? 2)
  const [minSession, setMinSession] = useState(user?.min_session_hours ?? 1.5)
  const [interleave, setInterleave] = useState(user?.interleave ?? true)
  const [suggestSteps, setSuggestSteps] = useState(user?.suggest_steps ?? true)
  const [showAtRisk, setShowAtRisk] = useState(user?.show_at_risk ?? true)
  const [busy, setBusy] = useState(false)

  const dirty =
    !!user &&
    (name.trim() !== user.name ||
      capacity !== user.daily_capacity_hours ||
      buffer !== user.buffer_days ||
      JSON.stringify(weekdays) !== JSON.stringify(user.weekday_hours) ||
      session !== user.max_session_hours ||
      minSession !== user.min_session_hours ||
      interleave !== user.interleave ||
      suggestSteps !== user.suggest_steps ||
      showAtRisk !== user.show_at_risk)
  const setDay = (i: number, v: number) => setWeekdays((w) => (w ? w.map((h, j) => (j === i ? v : h)) : w))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast('Name can’t be empty', 'error')
    if (weekdays && !weekdays.some(Boolean)) return toast('Give at least one day some study hours', 'error')
    setBusy(true)
    try {
      setUser(
        await settingsApi.update({
          name: name.trim(),
          daily_capacity_hours: capacity,
          buffer_days: buffer,
          weekday_hours: weekdays,
          max_session_hours: session,
          min_session_hours: minSession,
          interleave,
          suggest_steps: suggestSteps,
          show_at_risk: showAtRisk,
        }),
      )
      await reload()
      toast('Saved — your plan uses the new numbers')
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar icon="settings" crumbs={['Settings']} />
      <div className="flex-1 overflow-y-auto">
        <PageHeader narrow icon="settings" title="Settings" description="These numbers decide when AliveLine tells you to start." />
        <form onSubmit={submit} className={`${NARROW} pt-6`}>
          <h2 className="border-b border-line pb-3 text-section font-medium">Profile</h2>

          <Row label="Name" hint={user?.email ?? ''} htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="sm:w-48" />
          </Row>

          <h2 className="mt-8 border-b border-line pb-3 text-section font-medium">Planning</h2>

          <Row label="Study hours per day" hint="Focused hours you can really give to assignments on a normal day." htmlFor="capacity">
            <div className="flex items-center gap-3">
              <input
                id="capacity"
                type="range"
                min={0.5}
                max={12}
                step={0.5}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-36 accent-accent"
              />
              <span className="tnum w-10 text-right text-body font-medium">{hoursLabel(capacity)}</span>
            </div>
          </Row>

          <Row label="Different hours on some days" hint="E.g. less on weekends, or a day off with 0 hours." htmlFor="weekdays">
            <input
              id="weekdays"
              type="checkbox"
              checked={weekdays !== null}
              onChange={(e) => setWeekdays(e.target.checked ? Array(7).fill(capacity) : null)}
              className="h-4 w-4 accent-accent"
            />
          </Row>
          {weekdays && (
            <ul aria-label="Study hours by weekday" className="mb-2 grid gap-x-6 sm:grid-cols-2">
              {WEEKDAYS.map((day, i) => (
                <li key={day} className="flex h-10 items-center justify-between">
                  <span className="text-body text-text-2">{day}</span>
                  <Stepper
                    label={`${day} hours`}
                    value={weekdays[i]}
                    onChange={(v) => setDay(i, v)}
                    min={0}
                    max={12}
                    step={0.5}
                    format={(v) => (v ? hoursLabel(v) : 'Off')}
                  />
                </li>
              ))}
            </ul>
          )}

          <Row label="Mix tasks within a day" hint="Short sessions of different assignments instead of one long block." htmlFor="interleave">
            <input
              id="interleave"
              type="checkbox"
              checked={interleave}
              onChange={(e) => setInterleave(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </Row>

          {interleave && (
            <Row label="Longest session" hint="Max hours of one assignment per day. Exceeded only when a deadline needs it.">
              <Stepper label="session hours" value={session} onChange={setSession} min={0.5} max={8} step={0.5} />
            </Row>
          )}

          <Row label="Shortest session" hint="Don’t split an assignment into pieces smaller than this, unless a deadline leaves no choice.">
            <Stepper label="shortest session hours" value={minSession} onChange={setMinSession} min={0.5} max={4} step={0.5} />
          </Row>

          <Row label="Suggest steps" hint="For big tasks, AI offers to split the work into ordered steps (research, code, report…)." htmlFor="suggest-steps">
            <input
              id="suggest-steps"
              type="checkbox"
              checked={suggestSteps}
              onChange={(e) => setSuggestSteps(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </Row>

          <Row label="Warn about late work" hint="Show how many assignments won’t fit before their deadline, above the calendar." htmlFor="show-at-risk">
            <input
              id="show-at-risk"
              type="checkbox"
              checked={showAtRisk}
              onChange={(e) => setShowAtRisk(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </Row>

          <Row label="Safety buffer" hint="Aim to finish this many days before each real deadline.">
            <Stepper
              label="buffer days"
              value={buffer}
              onChange={setBuffer}
              min={0}
              max={7}
              step={1}
              format={(v) => `${v} day${v === 1 ? '' : 's'}`}
            />
          </Row>

          <div className="border-t border-line pt-5">
            <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
          </div>
        </form>
        <div className={`${NARROW} pb-24`}>
          <PlanSection />
        </div>
      </div>
    </>
  )
}
