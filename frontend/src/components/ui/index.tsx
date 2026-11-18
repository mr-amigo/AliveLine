import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { hoursLabel } from '../../lib/dates'
import { Icon } from './Icons'

export { Icon, type IconName } from './Icons'
export { ToastProvider, useToast } from './Toast'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

// Notion buttons: blue filled, white with hairline outline, borderless ghost (DESIGN.md §5).
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-bg text-text shadow-btn hover:bg-bg-hover',
  ghost: 'text-text-2 hover:bg-bg-hover active:bg-bg-press',
  danger: 'text-critical hover:bg-callout-red',
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
      className={`inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-colors duration-[120ms]
        disabled:cursor-not-allowed disabled:opacity-40 ${size === 'sm' ? 'h-7 px-2 text-body' : 'h-8 px-3 text-body'} ${variants[variant]} ${className}`}
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
      className={`grid h-7 w-7 shrink-0 place-items-center rounded text-text-3 transition-colors duration-[120ms] hover:bg-bg-hover hover:text-text-2 active:bg-bg-press ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Notion select tag: 20px pill, coloured bg + dark same-hue text. */
export function Tag({ className = '', style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <span style={style} className={`inline-flex h-5 max-w-full min-w-0 shrink-0 items-center rounded px-1.5 text-body leading-5 whitespace-nowrap ${className}`}>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-meta font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-meta text-text-3">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded bg-[rgba(242,241,238,0.6)] px-2.5 text-body text-text shadow-outline outline-none transition-shadow duration-[120ms] placeholder:text-text-3 focus:shadow-focus'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-8 ${inputClass} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`min-h-24 resize-y py-1.5 ${inputClass} ${className}`} {...props} />
}

/** Notion callout block: tinted background, icon on the left, default text colour. */
export function Alert({ kind = 'error', icon, children }: { kind?: 'error' | 'success' | 'warning' | 'info'; icon?: ReactNode; children: ReactNode }) {
  const styles = {
    error: ['bg-callout-red', 'text-critical'],
    success: ['bg-callout-green', 'text-done'],
    warning: ['bg-callout-orange', 'text-start'],
    info: ['bg-callout', 'text-text-2'],
  }[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded px-3.5 py-3 text-body text-text ${styles[0]}`}>
      <span className={`mt-0.5 shrink-0 ${styles[1]}`}>{icon ?? <Icon name={kind === 'success' ? 'check' : 'alert'} />}</span>
      <div className="min-w-0 flex-1">{children}</div>
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
  return <kbd className="font-sans text-tiny font-medium text-text-3">{children}</kbd>
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
    <div role="group" aria-label={label} className="inline-flex h-7 items-center rounded shadow-btn">
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
