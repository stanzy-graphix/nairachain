import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

function AuthLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, textDecoration: 'none' }}>
            <span style={{ color: 'var(--text)' }}>NAIRA</span>
            <span style={{ color: 'var(--accent)' }}>CHAIN</span>
          </Link>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 36 }} className="fade-in">
          {children}
        </div>
      </div>
    </div>
  )
}

export function SignupPage() {
  const { signup } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return toast.error('All fields required')
    if (form.password !== form.confirm) return toast.error('Passwords do not match')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await signup({ name: form.name, email: form.email, password: form.password })
      setDone(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <AuthLayout>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 10 }}>Verify Your Email</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          We've sent a verification link to <strong style={{ color: 'var(--text)' }}>{form.email}</strong>.<br />
          Click the link to activate your account.
        </div>
        <Link href="/auth/login" className="btn-primary" style={{ padding: '12px 28px', borderRadius: 8, fontSize: 14, display: 'inline-block', textDecoration: 'none' }}>
          Back to Login
        </Link>
      </div>
    </AuthLayout>
  )

  return (
    <AuthLayout>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Create Account</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>Join 18,000+ traders on NairaChain</div>

      {[['name', 'Full Name', 'Tunde Adeyemi', 'text'],
        ['email', 'Email Address', 'you@example.com', 'email'],
        ['password', 'Password', '••••••••', 'password'],
        ['confirm', 'Confirm Password', '••••••••', 'password'],
      ].map(([key, label, placeholder, type]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label className="label">{label}</label>
          <input type={type} placeholder={placeholder} value={form[key]} onChange={set(key)}
            className="input-field" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
      ))}

      <button onClick={submit} disabled={loading} className="btn-primary"
        style={{ width: '100%', padding: 14, borderRadius: 8, fontSize: 15, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>
        {loading ? 'Creating...' : 'Create Account →'}
      </button>

      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Already have an account?{' '}
        <Link href="/auth/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Login</Link>
      </div>
    </AuthLayout>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.email || !form.password) return toast.error('Enter email and password')
    setLoading(true)
    try {
      const user = await login(form)
      toast.success('Welcome back, ' + user.name.split(' ')[0] + '!')
      router.push(user.role === 'admin' ? '/admin' : '/market')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Welcome Back</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>Login to your NairaChain wallet</div>

      <div style={{ marginBottom: 16 }}>
        <label className="label">Email Address</label>
        <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')}
          className="input-field" />
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="label" style={{ margin: 0 }}>Password</label>
          <Link href="/auth/reset-password" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Forgot?</Link>
        </div>
        <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')}
          className="input-field" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>

      <button onClick={submit} disabled={loading} className="btn-primary"
        style={{ width: '100%', padding: 14, borderRadius: 8, fontSize: 15, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>
        {loading ? 'Logging in...' : 'Login →'}
      </button>

      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        No account?{' '}
        <Link href="/auth/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign Up Free</Link>
      </div>
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const { resetPasswordRequest } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!email) return toast.error('Enter your email')
    setLoading(true)
    try {
      await resetPasswordRequest(email)
      setDone(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {done ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 10 }}>Check Your Email</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>Reset link sent to <strong style={{ color: 'var(--text)' }}>{email}</strong></div>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Reset Password</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>Enter your email to receive a reset link</div>
          <label className="label">Email Address</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
            className="input-field" style={{ marginBottom: 20 }} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button onClick={submit} disabled={loading} className="btn-primary"
            style={{ width: '100%', padding: 14, borderRadius: 8, fontSize: 15, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>
            {loading ? 'Sending...' : 'Send Reset Link →'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <Link href="/auth/login" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>← Back to Login</Link>
          </div>
        </>
      )}
    </AuthLayout>
  )
}

// Page exports with no layout (auth pages have their own layout)
SignupPage.getLayout = (page) => page
LoginPage.getLayout = (page) => page
ResetPasswordPage.getLayout = (page) => page
