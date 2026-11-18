import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthForm from '../components/AuthForm'
import { Field, Input } from '../components/ui'

export default function SignIn() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit() {
    if (!email || !password) throw new Error('Enter your email and password')
    await signIn({ email, password })
    navigate(from, { replace: true })
  }

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to see what to start today."
      submitLabel="Sign in"
      onSubmit={submit}
      footer={<>No account yet? <Link to="/signup" className="font-semibold text-accent hover:underline">Sign up</Link></>}
    >
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucu.edu.ua" autoFocus />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </AuthForm>
  )
}
