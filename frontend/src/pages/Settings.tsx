import { useState, type FormEvent } from 'react'
import { ApiError, settingsApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Card, Field, Input } from '../components/ui'

export default function Settings() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [capacity, setCapacity] = useState(user?.daily_capacity_hours ?? 3)
  const [buffer, setBuffer] = useState(user?.buffer_days ?? 1)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      setUser(await settingsApi.update({ name: name.trim(), daily_capacity_hours: capacity, buffer_days: buffer }))
      setMessage({ kind: 'success', text: 'Saved. Your plan will use the new numbers.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Could not save' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted">These numbers shape when AliveLine tells you to start.</p>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-6">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </Field>
          <Field label={`Study hours per day: ${capacity} h`} hint="How many focused hours you can realistically spend on assignments per day.">
            <input type="range" min={0.5} max={12} step={0.5} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full accent-accent" />
          </Field>
          <Field label={`Safety buffer: ${buffer} day${buffer === 1 ? '' : 's'}`} hint="Your personal target finish is this many days before the real deadline.">
            <input type="range" min={0} max={7} step={1} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="w-full accent-accent" />
          </Field>
          {message && <Alert kind={message.kind}>{message.text}</Alert>}
          <Button type="submit" loading={busy}>Save changes</Button>
        </form>
      </Card>
    </div>
  )
}
