import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { waitlistApi } from '../api/client'
import Logo from '../components/Logo'
import { Alert, Button, Input } from '../components/ui'

const steps = [
  { n: '1', title: 'Collect deadlines', text: 'Import your Moodle calendar (.ics) or add assignments by hand.' },
  { n: '2', title: 'Estimate the work', text: 'AI reads each description and estimates the hours. You can correct it.' },
  { n: '3', title: 'Know when to start', text: 'AliveLine counts back from all deadlines and your daily hours.' },
]

const preview = [
  { title: 'Linear Algebra — Problem set 6', due: 'Due Fri', start: 'Start today', status: 'Time to start', color: 'bg-start' },
  { title: 'OOAD — Prototype report', due: 'Due Mon', start: 'Start was yesterday', status: 'Critical', color: 'bg-critical' },
  { title: 'Philosophy — Essay draft', due: 'Due in 12 days', start: 'Start Nov 26', status: 'Can wait', color: 'bg-wait' },
]

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

  if (state === 'done') return <Alert kind="success">You're on the list — we'll write to you soon.</Alert>
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucu.edu.ua" aria-label="Email" />
      <Button type="submit" variant="secondary" loading={state === 'busy'} className="shrink-0">Get early access</Button>
      {state === 'error' && <p className="text-sm text-critical">Please check the email and try again.</p>}
    </form>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5">
        <Logo />
        <div className="ml-auto flex gap-2">
          <Link to="/signin"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/signup"><Button>Get started</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="grid items-center gap-12 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">For UCU students</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Know when to <span className="text-accent">start</span>, not just when it's due.
            </h1>
            <p className="mt-5 text-lg text-muted">
              Moodle tells you the deadline. AliveLine estimates how many hours each assignment really takes and tells
              you the day to begin — so the night before stays free.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup"><Button className="px-6 py-3 text-base">Create free account</Button></Link>
              <Link to="/signin"><Button variant="secondary" className="px-6 py-3 text-base">Sign in</Button></Link>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-white p-5 shadow-lg shadow-black/5" aria-label="Example plan">
            <p className="mb-4 text-sm font-semibold text-muted">Your plan this week</p>
            <ul className="space-y-3">
              {preview.map((p) => (
                <li key={p.title} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{p.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${p.color}`}>{p.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{p.start} · {p.due}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-12">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-white p-6">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-dark">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="my-12 rounded-3xl bg-ink px-6 py-10 text-white md:px-12">
          <h2 className="text-2xl font-bold">Not ready yet? Join early access.</h2>
          <p className="mt-2 mb-6 text-white/70">We're testing with first- and second-year UCU students. Leave your email and we'll invite you.</p>
          <div className="max-w-lg text-ink"><WaitlistForm /></div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted">
        AliveLine · Artem Serhiichuk, Ostap Sukhomlyn, Andrii Antoniuk · UCU {new Date().getFullYear()}
      </footer>
    </div>
  )
}
