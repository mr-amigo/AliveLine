import type { Status } from '../../api/types'
import { STATUS } from '../../lib/status'

export default function StatusDot({ status, label = true }: { status: Status; label?: boolean }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label ? STATUS[status].label : undefined}
      aria-hidden={label ? undefined : true}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS[status].dot}`}
    />
  )
}
