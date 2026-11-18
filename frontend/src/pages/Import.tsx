import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, importApi, planApi } from '../api/client'
import type { ImportResult } from '../api/types'
import { useShell } from '../components/shell/AppShell'
import PageHeader, { NARROW } from '../components/shell/PageHeader'
import TopBar from '../components/shell/TopBar'
import { Alert, Button, Icon, Spinner } from '../components/ui'
import { AI_CAP, estimateWithAi } from '../lib/aiPass'

const MAX_BYTES = 1_000_000

type Phase =
  | { kind: 'idle' }
  | { kind: 'uploading'; name: string }
  | { kind: 'estimating'; result: ImportResult; done: number; total: number }
  | { kind: 'finished'; result: ImportResult; estimated: number; aiError: string | null }
  | { kind: 'error'; message: string }

export default function Import() {
  const { range, reload } = useShell()
  const input = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [over, setOver] = useState(false)
  const busy = phase.kind === 'uploading' || phase.kind === 'estimating'

  async function handle(file: File | undefined) {
    if (!file || busy) return
    if (!/\.ics$/i.test(file.name)) return setPhase({ kind: 'error', message: 'Choose the .ics file Moodle exported.' })
    if (file.size > MAX_BYTES) return setPhase({ kind: 'error', message: 'The file is larger than 1 MB. Export a shorter period.' })

    setPhase({ kind: 'uploading', name: file.name })
    let result: ImportResult
    try {
      result = await importApi.ics(file)
    } catch (err) {
      return setPhase({ kind: 'error', message: err instanceof ApiError ? err.message : 'Upload failed' })
    }

    // AI pass over new items (sequential, capped); the server already gave them a rule-based estimate.
    const ids = result.created_ids.slice(0, AI_CAP)
    let estimated = 0
    let aiError: string | null = null
    if (ids.length) {
      setPhase({ kind: 'estimating', result, done: 0, total: ids.length })
      try {
        const byId = new Map((await planApi.get(range.from, range.days)).assignments.map((a) => [a.id, a]))
        const items = ids.flatMap((id) => byId.get(id) ?? [])
        estimated = await estimateWithAi(items, (done) => setPhase({ kind: 'estimating', result, done, total: items.length }))
      } catch (err) {
        aiError = err instanceof ApiError ? err.message : 'AI estimates stopped'
      }
    }
    await reload()
    setPhase({ kind: 'finished', result, estimated, aiError })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    void handle(e.dataTransfer.files[0])
  }

  const result = phase.kind === 'estimating' || phase.kind === 'finished' ? phase.result : null

  return (
    <>
      <TopBar icon="upload" crumbs={['Import']} />
      <div className="flex-1 overflow-y-auto">
        <PageHeader
          narrow
          title="Import Moodle calendar"
          description="Bring every Moodle deadline in at once. Importing again later updates dates and keeps your own hours and done marks."
        />
        <div className={`${NARROW} space-y-6 pb-24 pt-6`}>

          <ol className="space-y-1 text-section leading-[1.5]">
            {[
              <>In Moodle, open <b className="font-medium">Calendar</b>.</>,
              <>Click <b className="font-medium">Import or export calendars</b>, then <b className="font-medium">Export calendar</b>.</>,
              <>Choose <b className="font-medium">All events</b> and <b className="font-medium">Recent and next 60 days</b>, then <b className="font-medium">Export</b>.</>,
              <>Drop the downloaded <b className="font-medium">.ics</b> file below.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-1">
                <span className="tnum w-6 shrink-0 text-center">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div
            role="button"
            tabIndex={0}
            aria-disabled={busy}
            onClick={() => !busy && input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && (e.preventDefault(), input.current?.click())}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className={`flex h-[120px] cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-body transition-colors duration-[120ms] ${
              over ? 'border-accent bg-accent-tint' : 'border-line-strong hover:bg-bg-hover/50'
            } ${busy ? 'cursor-wait opacity-60' : ''}`}
          >
            {phase.kind === 'uploading' ? (
              <>
                <Spinner />
                <span className="text-text-2">Reading {phase.name}…</span>
              </>
            ) : (
              <>
                <Icon name="file" className="text-text-2" />
                <span className="font-medium">Drop the .ics file here or click to choose</span>
                <span className="text-meta text-text-3">Up to 1 MB</span>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>

          {phase.kind === 'error' && <Alert>{phase.message}</Alert>}

          {result && (
            <section aria-label="Import result" className="space-y-3">
              <dl className="grid grid-cols-3 border-y border-line">
                {([['Added', result.created], ['Updated', result.updated], ['Skipped', result.skipped]] as const).map(([label, n], i) => (
                  <div key={label} className={`px-3 py-2 ${i ? 'border-l border-line' : ''}`}>
                    <dt className="text-meta text-text-2">{label}</dt>
                    <dd className="tnum text-h2 font-semibold">{n}</dd>
                  </div>
                ))}
              </dl>
              {result.skipped > 0 && (
                <p className="text-meta text-text-2">Skipped events are activity openings, attendance and deadlines that have already passed.</p>
              )}

              {phase.kind === 'estimating' && (
                <p className="flex items-center gap-2 text-label text-text-2" role="status">
                  <Spinner small />
                  Estimating {phase.done + 1 > phase.total ? phase.total : phase.done + 1}/{phase.total} with AI…
                </p>
              )}

              {phase.kind === 'finished' && (
                <>
                  {phase.aiError ? (
                    <Alert kind="warning">
                      AI estimates stopped ({phase.aiError}). The rest keep a rough estimate — open an assignment and press Re-estimate.
                    </Alert>
                  ) : (
                    phase.estimated > 0 && <p className="text-label text-text-2">AI estimated hours for {phase.estimated} new assignments.</p>
                  )}
                  {result.created_ids.length > AI_CAP && (
                    <p className="text-meta text-text-2">The first {AI_CAP} were estimated by AI; re-estimate others from their panel.</p>
                  )}
                  <Link to="/app"><Button>Open planner</Button></Link>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
