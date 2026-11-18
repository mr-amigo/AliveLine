import { Stepper } from '../ui'

export default function HoursStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <Stepper label="hours" value={value} onChange={onChange} min={0.5} max={100} step={0.5} />
}
