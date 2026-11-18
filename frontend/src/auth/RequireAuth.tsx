import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { useAuth } from './AuthContext'

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner fullScreen />
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  return children
}
