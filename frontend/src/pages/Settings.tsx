import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, settingsApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useShell } from '../components/shell/AppShell'
import TopBar from '../components/shell/TopBar'
import { Button, Input, Stepper, useToast } from '../components/ui'
import { hoursLabel } from '../lib/dates'

function Row({ label, hint, htmlFor, children }: { label: string; hint: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-label font-medium">{label}</label>
        <p className="text-meta text-text-2">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { user, setUser } = useAuth()
  const { reload } = useShell()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [capacity, setCapacity] = useState(user?.daily_capacity_hours ?? 3)
  const [buffer, setBuffer] = useState(user?.buffer_days ?? 1)
  const [busy, setBusy] = useState(false)

  const dirty = !!user && (name.trim() !== user.name || capacity !== user.daily_capacity_hours || buffer !== user.buffer_days)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast('Name can’t be empty', 'error')
    setBusy(true)
    try {
      setUser(await settingsApi.update({ name: name.trim(), daily_capacity_hours: capacity, buffer_days: buffer }))
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
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={submit} className="mx-auto max-w-[480px] px-4 py-6">
          <p className="pb-2 text-body text-text-2">These numbers decide when AliveLine tells you to start.</p>

          <Row label="Name" hint={user?.email ?? ''} htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="sm:w-48" />
          </Row>

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

          <div className="pt-4">
            <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
          </div>
        </form>
      </div>
    </>
  )
}
