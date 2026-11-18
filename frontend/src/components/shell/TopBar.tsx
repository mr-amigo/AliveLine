import type { ReactNode } from 'react'
import { Icon, IconButton } from '../ui'
import { useShell } from './AppShell'

/** Notion top bar (44px, no border): [menu on < lg] breadcrumbs · right-side actions. */
export default function TopBar({ icon, crumbs, right }: { icon: string; crumbs: string[]; right?: ReactNode }) {
  const { openMenu } = useShell()
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 px-3">
      <IconButton label="Open menu" className="lg:hidden" onClick={openMenu}>
        <Icon name="menu" />
      </IconButton>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-body text-text">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center">
            {i > 0 && <span className="px-0.5 text-text-3">/</span>}
            <span className={`flex h-6 min-w-0 items-center gap-1.5 rounded px-1.5 ${i === crumbs.length - 1 ? '' : 'text-text-2'}`}>
              {i === 0 && <span aria-hidden="true" className="text-[14px] leading-none">{icon}</span>}
              <span className="truncate">{c}</span>
            </span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </header>
  )
}
