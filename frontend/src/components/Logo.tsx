import { Link } from 'react-router-dom'

/** Monochrome mark + wordmark (DESIGN.md §9: own brand, never the reference product's logo). */
export default function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-section font-semibold tracking-tight text-text">
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <rect width="32" height="32" rx="6" className="fill-text" />
        <path d="M4 17h6l3-7 5 13 3-6h7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>AliveLine</span>
    </Link>
  )
}
