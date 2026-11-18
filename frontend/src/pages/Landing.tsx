import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, waitlistApi } from '../api/client'
import type { Assignment, Day, DayItem, Status } from '../api/types'
import SiteLayout from '../components/SiteLayout'
import WeekGrid from '../components/plan/WeekGrid'
import { Button, Input } from '../components/ui'
import { usePageMeta } from '../hooks/usePageMeta'
import { addDays, kyivToUtcIso, todayKyiv } from '../lib/dates'

const steps = [
  { title: 'Collect deadlines', text: 'Import your Moodle calendar in one file or add assignments yourself.' },
  { title: 'Estimate the work', text: 'AI reads each task and suggests the hours. Correct it whenever you know better.' },
  { title: 'Start on time', text: 'Your daily study hours are spread back from every deadline, so nothing piles up on the last night.' },
]

/** Demo plan for the next 7 days, rendered with the real WeekGrid. */
function demoPlan(today: string): { days: Day[]; assignments: Assignment[] } {
  const demo: { title: string; course: string; due: number; status: Status; blocks: [number, number][]; steps?: string[] }[] = [
    { title: 'Lab 3: REST API', course: 'OOAD', due: 3, status: 'critical', blocks: [[0, 2], [1, 2], [2, 1]], steps: ['Read the brief', 'Write the endpoints', 'Tests + report'] },
    { title: 'Problem set 6', course: 'Linear Algebra', due: 4, status: 'time_to_start', blocks: [[2, 2], [3, 2]] },
    { title: 'Essay draft', course: 'Philosophy', due: 5, status: 'time_to_start', blocks: [[0, 1], [1, 1], [3, 1], [4, 1]] },
    { title: 'Midterm prep', course: 'Calculus', due: 6, status: 'can_wait', blocks: [[4, 2], [5, 2]] },
  ]
  const days: Day[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i), capacity: 3, items: [] as DayItem[] }))
  const assignments = demo.map((d, id): Assignment => {
    d.blocks.forEach(([day, hours], i) =>
      days[day].items.push({
        assignment_id: id,
        title: d.title,
        course_name: d.course,
        hours,
        status: d.status,
        step_id: d.steps ? i : null,
        step_title: d.steps?.[i] ?? null,
      }),
    )
    return {
      id,
      title: d.title,
      description: '',
      course_name: d.course,
      deadline: kyivToUtcIso(addDays(today, d.due), '23:59'),
      source: 'manual',
      ai_hours: null,
      ai_rationale: null,
      estimate_source: 'ai',
      user_hours: null,
      effective_hours: d.blocks.reduce((s, [, h]) => s + h, 0),
      done: false,
      steps: (d.steps ?? []).map((title, i) => ({ id: i, title, hours: d.blocks[i][1], done: false })),
      window: { start_date: today, target_finish: addDays(today, d.due - 1), status: d.status, at_risk: false, shortfall_hours: 0 },
    }
  })
  return { days, assignments }
}

function WaitlistForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await waitlistApi.join(email.trim())
      navigate('/thanks')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That didn’t go through. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2" aria-describedby={error ? 'waitlist-error' : undefined}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@ucu.edu.ua"
          aria-label="Email for early access"
          aria-invalid={!!error}
        />
        <Button type="submit" variant="secondary" loading={busy}>Get early access</Button>
      </div>
      {error && <p id="waitlist-error" role="alert" className="text-meta text-critical-text">{error}</p>}
    </form>
  )
}

/** Fixed bottom CTA on phones once the hero buttons scroll away. */
function useHeroOutOfView() {
  const ref = useRef<HTMLDivElement>(null)
  const [out, setOut] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setOut(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, out }
}

export default function Landing() {
  usePageMeta(null)
  const today = todayKyiv()
  const demo = useMemo(() => demoPlan(today), [today])
  const hero = useHeroOutOfView()

  return (
    <SiteLayout footerClassName="pb-28 md:pb-8">
      <main className="mx-auto max-w-6xl px-6">
        <section className="max-w-2xl pb-10 pt-4 md:pb-12 md:pt-20">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[64px]">
            Know when to start, not just when it’s due.
          </h1>
          <p className="mt-4 max-w-xl text-section font-medium text-text-2 md:mt-5 md:text-title">
            Moodle shows the deadline. AliveLine estimates the hours each assignment takes and spreads them over your
            week, so you always know what to open today.
          </p>
          <div ref={hero.ref} className="mt-6 flex flex-wrap gap-2 md:mt-8">
            <Link to="/signup"><Button className="h-10 rounded-md px-5 text-section">Create free account</Button></Link>
            <Link to="/signin"><Button variant="secondary" className="h-10 rounded-md px-5 text-section">Sign in</Button></Link>
          </div>
        </section>

        <section aria-label="Example plan for the next 7 days" className="overflow-hidden rounded-xl bg-bg shadow-card">
          <div className="flex h-11 items-center px-4 text-body font-medium text-text-2">
            Your next 7 days at 3 h of study a day
          </div>
          <WeekGrid days={demo.days} assignments={demo.assignments} today={today} />
        </section>

        <section className="py-16">
          <h2 className="text-h1 font-bold">How it works</h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t border-line pt-4">
                <span className="tnum text-meta font-medium text-text-3">Step {i + 1}</span>
                <h3 className="mt-1 text-title font-semibold">{s.title}</h3>
                <p className="mt-1 text-body text-text-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 border-t border-line py-16 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-h1 font-bold">Early access for UCU students</h2>
            <p className="mt-1 text-body text-text-2">We’re testing with first- and second-year students. Leave your email and we’ll send an invite.</p>
          </div>
          <WaitlistForm />
        </section>
      </main>

      <div
        aria-hidden={!hero.out}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-transform duration-[180ms] md:hidden ${
          hero.out ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <Link to="/signup" tabIndex={hero.out ? 0 : -1} className="block">
          <Button tabIndex={-1} className="h-10 w-full rounded-md text-section">Create free account</Button>
        </Link>
      </div>
    </SiteLayout>
  )
}
