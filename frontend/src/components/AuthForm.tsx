import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import { Alert, Button } from './ui'

/** Shared shell for sign-in / sign-up: centred 360px column, submit handling, error display (DESIGN.md §5). */
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
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[360px]">
        <Logo />
        <h1 className="mt-8 text-title font-semibold">{title}</h1>
        <p className="mt-1 mb-6 text-body text-text-2">{subtitle}</p>
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {children}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="mt-2 w-full">{submitLabel}</Button>
        </form>
        <p className="mt-6 text-label text-text-2">{footer}</p>
        <Link to="/" className="mt-2 inline-block text-meta text-text-3 hover:text-text">Back to home</Link>
      </div>
    </div>
  )
}
