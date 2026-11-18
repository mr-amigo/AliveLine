import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import Logo from './Logo'
import { Alert, Button, Card } from './ui'

/** Shared shell for sign-in / sign-up: layout, submit handling, error display. */
export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  footer,
  onSubmit,
  children,
}: {
  title: string
  subtitle: string
  submitLabel: string
  footer: ReactNode
  onSubmit: () => Promise<void>
  children: ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit()
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8"><Logo /></div>
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {children}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">{submitLabel}</Button>
        </form>
      </Card>
      <p className="mt-6 text-sm text-muted">{footer}</p>
      <Link to="/" className="mt-2 text-xs text-muted hover:text-ink">← Back to home</Link>
    </div>
  )
}
