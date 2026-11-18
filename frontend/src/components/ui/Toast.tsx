import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Kind = 'info' | 'error'
interface ToastState { id: number; text: string; kind: Kind }

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => undefined)

/** Bottom-centre pop for API errors (`detail`) and confirmations (DESIGN.md §5). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number>()

  const show = useCallback((text: string, kind: Kind = 'info') => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), text, kind })
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 5000 : 2500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`animate-fade pointer-events-auto max-w-md rounded-md bg-bg px-3.5 py-2 text-label font-medium shadow-pop ${
              toast.kind === 'error' ? 'text-critical-text' : 'text-text'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
