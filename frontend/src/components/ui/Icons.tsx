// 16px inline icons, 1.5px stroke (DESIGN.md §9: no emoji as UI icons).
const paths = {
  'chevron-left': 'M10 3.5 5.5 8l4.5 4.5',
  'chevron-right': 'M6 3.5 10.5 8 6 12.5',
  'chevron-down': 'M3.5 6 8 10.5 12.5 6',
  plus: 'M8 3v10M3 8h10',
  minus: 'M3 8h10',
  x: 'M4 4l8 8M12 4l-8 8',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  flag: 'M3.5 14V2.5m0 0h8l-1.8 3 1.8 3h-8',
  alert: 'M8 2 1.5 13.5h13L8 2Zm0 4.5v3.5m0 1.75v.25',
  check: 'M3 8.5 6.5 12 13 4.5',
  trash: 'M2.5 4h11M6 4V2.5h4V4m-6 0 .6 9.5h6.8L12 4',
  upload: 'M8 10.5V2.5m0 0L5 5.5m3-3 3 3M2.5 10v3.5h11V10',
  settings: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5-2 1.3-.8-1.2-2.1-1.5.4a5 5 0 0 0-1.3-.8L10 3H7.6l-.4 1.5a5 5 0 0 0-1.3.8l-1.5-.4L3.2 7l1.1 1-1.1 1 1.2 2.1 1.5-.4c.4.3.8.6 1.3.8l.4 1.5H10l.3-1.5c.5-.2.9-.5 1.3-.8l1.5.4L14.3 9 13 8Z',
  logout: 'M6 2.5H3v11h3m4-3 3-2.5-3-2.5m3 2.5H6',
  calendar: 'M2.5 4h11v9.5h-11V4Zm0 3h11M5.5 2.5v3m5-3v3',
  list: 'M5.5 4h8m-8 4h8m-8 4h8M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  sparkle: 'M8 2v3m0 6v3M2 8h3m6 0h3M4.2 4.2l1.6 1.6m4.4 4.4 1.6 1.6m0-7.6-1.6 1.6M5.8 10.2l-1.6 1.6',
  file: 'M9 2H4v12h8V5L9 2Zm0 0v3h3',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={`shrink-0 ${className}`}
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}
