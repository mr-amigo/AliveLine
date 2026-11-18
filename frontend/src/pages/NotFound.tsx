import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-bold text-accent">404</p>
        <p className="mt-2 text-muted">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block"><Button>Go home</Button></Link>
      </div>
    </div>
  )
}
