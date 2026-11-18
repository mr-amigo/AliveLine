import type { ReactNode } from 'react'

/** 30px Notion sidebar row. */
export const rowClass = 'flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left text-body font-medium transition-colors duration-[120ms]'

export function SidebarSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const id = `sb-${title.toLowerCase()}`
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex h-[30px] items-center justify-between px-2 text-meta font-medium text-text-3">
        <span>{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  )
}
