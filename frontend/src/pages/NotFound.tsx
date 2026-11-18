import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-page font-bold">404</p>
        <p className="mt-2 text-text-2">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block"><Button>Go home</Button></Link>
      </div>
    </div>
  )
}
