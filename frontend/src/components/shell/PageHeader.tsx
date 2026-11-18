import type { ReactNode } from 'react'
import { Icon, type IconName } from '../ui'

/** Notion page gutters: full-width pages pad 96px on desktop; narrow pages are a 708px column. */
export const PAGE_X = 'px-6 md:px-12 xl:px-24'
export const NARROW = 'mx-auto w-full max-w-[756px] px-6'

/** Notion page header: line-icon tile (in place of Notion's emoji, DESIGN.md §9), 40px bold title, grey description. */
export default function PageHeader({ icon, title, description, narrow = false }: { icon?: IconName; title: string; description?: ReactNode; narrow?: boolean }) {
  return (
    <div className={`${narrow ? NARROW : PAGE_X} pt-8 md:pt-12`}>
      {icon && (
        <div aria-hidden="true" className="mb-3 grid h-12 w-12 place-items-center rounded-md bg-callout text-text-2 md:mb-4 md:h-14 md:w-14">
          <Icon name={icon} className="h-6 w-6 md:h-7 md:w-7" />
        </div>
      )}
      <h1 className="text-h1 font-bold tracking-[-0.01em] md:text-page">{title}</h1>
      {description && <div className="mt-1 text-section text-text-2">{description}</div>}
    </div>
  )
}
