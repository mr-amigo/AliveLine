import { useState } from 'react'
import { usePageMeta } from '../hooks/usePageMeta'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthForm from '../components/AuthForm'
import { Field, Input } from '../components/ui'

export default function SignUp() {
  usePageMeta('Create account', 'Create a free AliveLine account: import Moodle deadlines and get a plan for when to start.')
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit() {
    if (!name.trim()) throw new Error('Tell us your name')
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')
    await signUp({ name: name.trim(), email, password })
    navigate('/app', { replace: true })
  }

  return (
    <AuthForm
      title="Create your account"
      subtitle="Stop starting the night before."
      submitLabel="Create account"
      onSubmit={submit}
      footer={<>Already have an account? <Link to="/signin" className="text-accent underline underline-offset-2 hover:text-accent-hover">Sign in</Link></>}
    >
      <Field label="Name">
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ostap" autoFocus />
      </Field>
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucu.edu.ua" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </AuthForm>
  )
}
