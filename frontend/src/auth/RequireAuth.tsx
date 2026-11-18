import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loading } from '../components/ui'
import { useAuth } from './AuthContext'

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 3000)
    return () => window.clearTimeout(t)
  }, [])

  if (loading) return <div className="grid min-h-screen place-items-center"><Loading slow={slow} /></div>
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  return children
}
