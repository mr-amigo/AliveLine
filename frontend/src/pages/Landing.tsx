import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { waitlistApi } from '../api/client'
import type { Assignment, Day, DayItem, Status } from '../api/types'
import Logo from '../components/Logo'
import WeekGrid from '../components/plan/WeekGrid'
import { Alert, Button, Input } from '../components/ui'
import { addDays, kyivToUtcIso, todayKyiv } from '../lib/dates'

const steps = [
  { title: 'Collect deadlines', text: 'Import your Moodle calendar in one file or add assignments yourself.' },
  { title: 'Estimate the work', text: 'AI reads each task and suggests the hours. Correct it whenever you know better.' },
  { title: 'Start on time', text: 'Your daily study hours are spread back from every deadline, so nothing piles up on the last night.' },
]

/** Demo plan for the next 7 days, rendered with the real WeekGrid. */
function demoPlan(today: string): { days: Day[]; assignments: Assignment[] } {
  const demo: { title: string; course: string; due: number; status: Status; blocks: [number, number][] }[] = [
    { title: 'Lab 3: REST API', course: 'OOAD', due: 3, status: 'critical', blocks: [[0, 2], [1, 2], [2, 1]] },
    { title: 'Problem set 6', course: 'Linear Algebra', due: 4, status: 'time_to_start', blocks: [[2, 2], [3, 2]] },
    { title: 'Essay draft', course: 'Philosophy', due: 5, status: 'time_to_start', blocks: [[0, 1], [1, 1], [3, 1], [4, 1]] },
    { title: 'Midterm prep', course: 'Calculus', due: 6, status: 'can_wait', blocks: [[4, 2], [5, 2]] },
  ]
  const days: Day[] = Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i), items: [] as DayItem[] }))
  const assignments = demo.map((d, id): Assignment => {
    for (const [day, hours] of d.blocks)
      days[day].items.push({ assignment_id: id, title: d.title, course_name: d.course, hours, status: d.status })
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
      window: { start_date: today, target_finish: addDays(today, d.due - 1), status: d.status, unscheduled_hours: 0 },
    }
  })
  return { days, assignments }
}

function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('busy')
    try {
      await waitlistApi.join(email)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') return <Alert kind="success">You're on the list. We'll email you when your invite is ready.</Alert>
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucu.edu.ua" aria-label="Email" />
        <Button type="submit" variant="secondary" loading={state === 'busy'}>Get early access</Button>
      </div>
      {state === 'error' && <p className="text-meta text-critical-text">That email didn't go through. Check it and try again.</p>}
    </form>
  )
}

export default function Landing() {
  const today = todayKyiv()
  const demo = useMemo(() => demoPlan(today), [today])

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-5">
        <Logo />
        <div className="ml-auto flex gap-2">
          <Link to="/signin"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/signup"><Button>Get started</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="max-w-2xl pb-12 pt-12 md:pt-20">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[64px]">
            Know when to start, not just when it's due.
          </h1>
          <p className="mt-5 max-w-xl text-title font-medium text-text-2">
            Moodle shows the deadline. AliveLine estimates the hours each assignment takes and spreads them over your
            week, so you always know what to open today.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link to="/signup"><Button className="h-10 rounded-md px-5 text-section">Create free account</Button></Link>
            <Link to="/signin"><Button variant="secondary" className="h-10 rounded-md px-5 text-section">Sign in</Button></Link>
          </div>
        </section>

        <section aria-label="Example plan for the next 7 days" className="overflow-hidden rounded-xl bg-bg shadow-card">
          <div className="flex h-11 items-center px-4 text-body font-medium text-text-2">
            Your next 7 days at 3 h of study a day
          </div>
          <WeekGrid days={demo.days} assignments={demo.assignments} capacity={3} today={today} />
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
            <p className="mt-1 text-body text-text-2">We're testing with first- and second-year students. Leave your email and we'll send an invite.</p>
          </div>
          <WaitlistForm />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-line px-6 py-8 text-meta text-text-2">
        AliveLine · Artem Serhiichuk, Ostap Sukhomlyn, Andrii Antoniuk · UCU {new Date().getFullYear()}
      </footer>
    </div>
  )
}
