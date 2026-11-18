import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from './Logo'
import { Button } from './ui'

export const CONTACT_EMAIL = 'mr.amigo98797@gmail.com'

const footerLinks = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/contact', label: 'Contact' },
]

/** Public pages (landing, legal, thanks, 404): logo header with auth actions, footer with legal links + contact email. */
export default function SiteLayout({ children, footerClassName = '' }: { children: ReactNode; footerClassName?: string }) {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-5">
        <Logo />
        <div className="ml-auto flex gap-2">
          {user ? (
            <Link to="/app"><Button>Open planner</Button></Link>
          ) : (
            <>
              <Link to="/signin"><Button variant="ghost">Sign in</Button></Link>
              <Link to="/signup" className="hidden sm:block"><Button>Get started</Button></Link>
            </>
          )}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className={`mx-auto w-full max-w-6xl border-t border-line px-6 py-8 text-meta text-text-2 ${footerClassName}`}>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {footerLinks.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-text">{l.label}</Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-text">{CONTACT_EMAIL}</a>
        </nav>
        <p className="mt-3">AliveLine · Artem Serhiichuk, Ostap Sukhomlyn, Andrii Antoniuk · UCU {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}

/** Narrow text page (legal, contact, thanks): Notion page header + readable column. */
export function TextPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[756px] px-6 pb-20 pt-8 md:pt-12">
      <h1 className="text-h1 font-bold tracking-[-0.01em] md:text-page">{title}</h1>
      {updated && <p className="mt-1 text-body text-text-2">Last updated {updated}</p>}
      <div className="mt-8 space-y-4 text-section leading-[1.6] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-title [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  )
}
