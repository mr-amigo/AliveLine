import type { ReactNode } from 'react'

/** Notion page gutters: full-width pages pad 96px on desktop; narrow pages are a 708px column. */
export const PAGE_X = 'px-6 md:px-12 xl:px-24'
export const NARROW = 'mx-auto w-full max-w-[756px] px-6'

/** Notion page header: 40px bold title, optional grey description (no icon: DESIGN.md §9). */
export default function PageHeader({ title, description, narrow = false }: { title: string; description?: ReactNode; narrow?: boolean }) {
  return (
    <div className={`${narrow ? NARROW : PAGE_X} pt-8 md:pt-12`}>
      <h1 className="text-h1 font-bold tracking-[-0.01em] md:text-page">{title}</h1>
      {description && <div className="mt-1 text-section text-text-2">{description}</div>}
    </div>
  )
}
