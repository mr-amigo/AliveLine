import { Link } from 'react-router-dom'
import { PRICES } from './PlanSection'
import { Button, Icon } from './ui'

const FREE = [
  'Deadlines: add yourself or import from Moodle',
  'Plan: when to start each assignment, day by day',
  'Day, 3-day, week, month and list views',
  'AI estimate for every assignment (100 a month)',
  '3 free tries of each Pro feature',
]
const PRO = [
  'Everything in Free',
  'AI steps: big tasks split into ordered parts',
  'Re-estimate with AI as often as you like',
  '1,000 AI estimates a month',
]

function Plan({ name, price, note, items, cta }: { name: string; price: string; note: string; items: string[]; cta: JSX.Element }) {
  return (
    <div className="flex flex-col rounded-xl bg-bg p-6 shadow-card">
      <h3 className="text-title font-semibold">{name}</h3>
      <p className="mt-2">
        <span className="text-h1 font-bold">{price}</span> <span className="text-body text-text-2">{note}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-body">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Icon name="check" className="mt-0.5 shrink-0 text-done" />
            {i}
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  )
}

/** Free vs Pro cards (landing section + /pricing). Prices in USD; Paddle adds local taxes at checkout. */
export default function Pricing() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Plan
          name="Free"
          price="$0"
          note="forever"
          items={FREE}
          cta={<Link to="/signup" className="block"><Button variant="secondary" className="w-full">Create free account</Button></Link>}
        />
        <Plan
          name="Pro"
          price={PRICES.monthly}
          note={`a month, or ${PRICES.yearly} a year`}
          items={PRO}
          cta={<Link to="/app/settings#plan" className="block"><Button className="w-full">Get Pro</Button></Link>}
        />
      </div>
      <p className="mt-4 text-meta text-text-2">
        Payments are handled by Paddle, our reseller and merchant of record; local taxes may be added at checkout. Cancel any time;
        see the <Link to="/refunds" className="underline underline-offset-2">refund policy</Link>.
      </p>
    </div>
  )
}
