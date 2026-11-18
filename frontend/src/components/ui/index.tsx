import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { hoursLabel } from '../../lib/dates'
import { Icon } from './Icons'

export { Icon, type IconName } from './Icons'
export { ToastProvider, useToast } from './Toast'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-95',
  secondary: 'bg-bg text-text border border-line-strong hover:bg-bg-hover',
  ghost: 'text-text-2 hover:text-text hover:bg-bg-hover',
  danger: 'text-critical-text hover:bg-critical-tint',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded px-3 text-label font-medium transition-[background-color,filter] duration-[120ms]
        disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'h-7' : 'h-8'} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded text-text-2 transition-colors duration-[120ms] hover:bg-bg-hover hover:text-text ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-meta text-text-2">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded border border-line bg-bg-subtle px-2.5 text-body text-text outline-none transition-colors duration-[120ms] placeholder:text-text-3 focus:border-line-strong focus:bg-bg'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-8 ${inputClass} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`min-h-24 resize-y py-1.5 ${inputClass} ${className}`} {...props} />
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = {
    error: 'bg-critical-tint text-critical-text',
    success: 'bg-accent-tint text-done-text',
    warning: 'bg-start-tint text-start-text',
  }[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded px-3 py-2 text-label ${styles}`}>
      {children}
    </div>
  )
}

export function Spinner({ small = false, fullScreen = false }: { small?: boolean; fullScreen?: boolean }) {
  const spinner = (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-3.5 w-3.5' : 'h-5 w-5 text-text-3'}`}
    />
  )
  return fullScreen ? <div className="grid min-h-screen place-items-center">{spinner}</div> : spinner
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-bg-hover ${className}`} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-line-strong px-1 font-sans text-tiny font-medium text-text-2">
      {children}
    </kbd>
  )
}

/** − value + control; used for hours (0.5 step) and buffer days. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step,
  format = hoursLabel,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
  label: string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)))
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center rounded border border-line bg-bg-subtle">
      <IconButton label={`Less ${label}`} onClick={() => set(value - step)} disabled={value <= min} className="disabled:opacity-40">
        <Icon name="minus" />
      </IconButton>
      <span className="tnum min-w-12 text-center text-body font-medium" aria-live="polite">{format(value)}</span>
      <IconButton label={`More ${label}`} onClick={() => set(value + step)} disabled={value >= max} className="disabled:opacity-40">
        <Icon name="plus" />
      </IconButton>
    </div>
  )
}

/** Spinner that adds "Waking up the server…" after 3 s (Aurora resumes from pause, DESIGN.md §6). */
export function Loading({ slow }: { slow: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-meta text-text-2">
      <Spinner />
      {slow && <p>Waking up the server… the first request can take up to 15 s.</p>}
    </div>
  )
}
