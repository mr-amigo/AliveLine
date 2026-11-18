import { useAuth } from '../auth/AuthContext'
import { Button, Card } from '../components/ui'

// Placeholder until Phase 4/7 (assignments, planner, today panel).
export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div>
      <h1 className="text-2xl font-bold">Hi, {user?.name} 👋</h1>
      <p className="mt-1 text-muted">Here's what to start — based on {user?.daily_capacity_hours} h of study per day.</p>
      <Card className="mt-8 text-center">
        <p className="text-lg font-semibold">No assignments yet</p>
        <p className="mt-1 text-sm text-muted">Add your first assignment or import your Moodle calendar.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button disabled>Add assignment</Button>
          <Button variant="secondary" disabled>Import .ics</Button>
        </div>
        <p className="mt-3 text-xs text-muted">Coming in the next version.</p>
      </Card>
    </div>
  )
}
