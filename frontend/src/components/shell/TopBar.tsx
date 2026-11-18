import type { ReactNode } from 'react'
import { Icon, IconButton } from '../ui'
import { useShell } from './AppShell'

/** 48px bar: [menu on < lg] left controls · title · right controls. */
export default function TopBar({ title, left, right, titleOnMobile = true }: { title: string; left?: ReactNode; right?: ReactNode; titleOnMobile?: boolean }) {
  const { openMenu } = useShell()
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line px-3 md:gap-2 md:px-4">
      <IconButton label="Open menu" className="lg:hidden" onClick={openMenu}>
        <Icon name="menu" />
      </IconButton>
      {left}
      <h1 className={`ml-1 min-w-0 truncate text-section font-semibold md:text-title ${titleOnMobile ? '' : 'sr-only sm:not-sr-only'}`}>
        {title}
      </h1>
      <div className="ml-auto flex items-center gap-1.5 md:gap-2">{right}</div>
    </header>
  )
}
