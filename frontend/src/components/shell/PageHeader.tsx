import type { ReactNode } from 'react'

/** Notion page gutters: full-width pages pad 96px on desktop; narrow pages are a 708px column. */
export const PAGE_X = 'px-6 md:px-12 xl:px-24'
export const NARROW = 'mx-auto w-full max-w-[756px] px-6'

/** Notion page header: large emoji icon, 40px bold title, optional grey description. */
export default function PageHeader({ icon, title, description, narrow = false }: { icon: string; title: string; description?: ReactNode; narrow?: boolean }) {
  return (
    <div className={`${narrow ? NARROW : PAGE_X} pt-8 md:pt-12`}>
      <div aria-hidden="true" className="h-12 w-12 select-none text-[40px] leading-[48px] md:h-[78px] md:w-[78px] md:text-[64px] md:leading-[78px]">
        {icon}
      </div>
      <h1 className="mt-2 text-h1 font-bold tracking-[-0.01em] md:mt-3 md:text-page">{title}</h1>
      {description && <div className="mt-1 text-section text-text-2">{description}</div>}
    </div>
  )
}
