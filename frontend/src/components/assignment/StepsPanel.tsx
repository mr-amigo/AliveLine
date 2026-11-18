import { useEffect, useState } from 'react'
import { aiApi, ApiError, assignmentsApi } from '../../api/client'
import type { Assignment, StepDraft } from '../../api/types'
import { hoursLabel } from '../../lib/dates'
import { Button, Icon, IconButton, Stepper, useToast } from '../ui'

const MAX_STEPS = 10
const AUTO_MIN_HOURS = 4 // AI offers a split on its own only for tasks at least this big
const DISMISSED_KEY = 'al_steps_dismissed'
const suggestions = new Map<number, StepDraft[]>() // per session: one AI call per assignment

function dismissed(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

function dismiss(id: number) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed().add(id)]))
  } catch {
    /* storage unavailable: the suggestion may come back next session */
  }
}

const half = (h: number) => Math.max(0.5, Math.round(h) / 2)
const errText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong')

interface Props {
  a: Assignment
  /** Current form text, so the AI reads unsaved edits too. */
  title: string
  description: string
  course: string
  autoSuggest: boolean
  onChanged: () => Promise<void>
}

/** Ordered steps of a big assignment: AI suggestion (accept / edit / dismiss), manual split, check off, reorder. */
export default function StepsPanel({ a, title, description, course, autoSuggest, onChanged }: Props) {
  const toast = useToast()
  const [suggestion, setSuggestion] = useState<StepDraft[] | null>(suggestions.get(a.id)?.length ? suggestions.get(a.id)! : null)
  const [draft, setDraft] = useState<StepDraft[] | null>(null)
  const [noSplit, setNoSplit] = useState(false)
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null)
  const steps = a.steps

  async function suggest(quiet: boolean) {
    setBusy('ai')
    setNoSplit(false)
    try {
      const res = await aiApi.steps({ title: title.trim() || a.title, description, course_name: course.trim() || null, hours: a.effective_hours })
      suggestions.set(a.id, res.steps)
      if (res.steps.length) setSuggestion(res.steps)
      else if (quiet) dismiss(a.id)
      else setNoSplit(true)
    } catch (err) {
      if (!quiet) toast(`Suggestion failed: ${errText(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  // Offer a split on its own once per big AI-estimated task (never again after Dismiss).
  useEffect(() => {
    const big = a.estimate_source === 'ai' && a.effective_hours >= AUTO_MIN_HOURS
    if (autoSuggest && big && !a.done && steps.length === 0 && !suggestions.has(a.id) && !dismissed().has(a.id)) {
      void suggest(true)
    }
  }, [a.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(next: StepDraft[], message: string) {
    setBusy('save')
    try {
      await assignmentsApi.setSteps(a.id, next.map((s) => ({ title: s.title.trim(), hours: s.hours, done: !!s.done })))
      await onChanged()
      setDraft(null)
      setSuggestion(null)
      suggestions.delete(a.id)
      toast(message)
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  function onDismiss() {
    dismiss(a.id)
    setSuggestion(null)
  }

  const toggle = (i: number) =>
    save(
      steps.map((s, j) => (j === i ? { ...s, done: !s.done } : s)),
      steps[i].done ? 'Step reopened' : 'Step done',
    )

  const update = (i: number, patch: Partial<StepDraft>) => setDraft((d) => d!.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...d!]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })
  const draftValid = !!draft && draft.length > 0 && draft.every((s) => s.title.trim() !== '')
  const left = steps.filter((s) => !s.done).reduce((sum, s) => sum + s.hours, 0)
  const total = steps.reduce((sum, s) => sum + s.hours, 0)

  return (
    <section aria-labelledby="steps-heading" className="mt-6">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <h3 id="steps-heading" className="mr-auto flex items-center gap-1.5 text-body font-semibold">
          <Icon name="list" className="text-text-3" />
          Steps
          {steps.length > 0 && (
            <span className="tnum font-normal text-text-3">
              {hoursLabel(left)} left of {hoursLabel(total)}
            </span>
          )}
        </h3>
        {!draft && !suggestion && (
          <>
            {steps.length === 0 && (
              <Button variant="ghost" size="sm" onClick={() => suggest(false)} loading={busy === 'ai'} disabled={busy !== null || a.done}>
                {busy !== 'ai' && <Icon name="sparkle" />}
                Suggest with AI
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                setDraft(
                  steps.length
                    ? steps.map(({ title, hours, done }) => ({ title, hours, done }))
                    : [
                        { title: '', hours: half(a.effective_hours) },
                        { title: '', hours: Math.max(0.5, a.effective_hours - half(a.effective_hours)) },
                      ],
                )
              }
            >
              {steps.length ? 'Edit' : 'Split'}
            </Button>
          </>
        )}
      </div>

      {noSplit && !draft && <p className="mt-1 px-1 text-body text-text-2">AI thinks this one is best done in one go.</p>}
      {steps.length === 0 && !draft && !suggestion && !noSplit && (
        <p className="mt-1 px-1 text-body text-text-3">Big task with distinct parts? Split it, and the plan keeps the steps in order.</p>
      )}

      {suggestion && !draft && (
        <div className="mt-2 rounded bg-callout px-4 py-3 text-body">
          <p className="flex items-center gap-1.5 font-semibold">
            <Icon name="sparkle" className="text-start" />
            AI suggests {suggestion.length} steps
          </p>
          <ol className="mt-2 space-y-1">
            {suggestion.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="tnum w-4 shrink-0 text-text-3">{i + 1}.</span>
                <span className="min-w-0 flex-1">{s.title}</span>
                <span className="tnum shrink-0 text-text-2">{hoursLabel(s.hours)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(suggestion, `Split into ${suggestion.length} steps`)} loading={busy === 'save'}>
              Accept
            </Button>
            <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setDraft(suggestion)}>Edit</Button>
            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={onDismiss}>Dismiss</Button>
          </div>
        </div>
      )}

      {draft ? (
        <div className="mt-2 space-y-1">
          {draft.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 rounded px-1 py-0.5 hover:bg-bg-hover sm:flex-nowrap">
              <span className="tnum w-5 shrink-0 text-center text-meta text-text-3">{i + 1}</span>
              <input
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                maxLength={200}
                placeholder="Step title"
                aria-label={`Step ${i + 1} title`}
                className="h-7 min-w-0 flex-1 rounded bg-transparent px-2 text-body outline-none placeholder:text-text-3 focus:bg-bg focus:shadow-focus"
              />
              <Stepper label={`step ${i + 1} hours`} value={s.hours} onChange={(h) => update(i, { hours: h })} min={0.5} max={40} step={0.5} />
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-40">
                <Icon name="chevron-down" className="rotate-180" />
              </IconButton>
              <IconButton label="Move down" disabled={i === draft.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-40">
                <Icon name="chevron-down" />
              </IconButton>
              <IconButton label="Remove step" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Icon name="x" />
              </IconButton>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {draft.length < MAX_STEPS && (
              <Button variant="ghost" size="sm" onClick={() => setDraft([...draft, { title: '', hours: 1 }])}>
                <Icon name="plus" />
                Add step
              </Button>
            )}
            <span className="tnum mr-auto text-meta text-text-3">{hoursLabel(draft.reduce((sum, s) => sum + s.hours, 0))} in total</span>
            {steps.length > 0 && (
              <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => save([], 'Split removed')}>Remove split</Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" disabled={!draftValid} loading={busy === 'save'} onClick={() => save(draft, 'Steps saved')}>Save steps</Button>
          </div>
        </div>
      ) : (
        steps.length > 0 && (
          <ol className="mt-1 space-y-px">
            {steps.map((s, i) => (
              <li key={s.id}>
                <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-1 hover:bg-bg-hover">
                  <input
                    type="checkbox"
                    checked={s.done}
                    disabled={busy !== null}
                    onChange={() => toggle(i)}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <span className={`min-w-0 flex-1 truncate text-body ${s.done ? 'text-text-3 line-through' : ''}`}>{s.title}</span>
                  <span className="tnum shrink-0 text-meta text-text-2">{hoursLabel(s.hours)}</span>
                </label>
              </li>
            ))}
          </ol>
        )
      )}
      {steps.length > 0 && !draft && <p className="mt-1 px-1 text-meta text-text-3">The plan uses the hours of open steps, in this order.</p>}
    </section>
  )
}
