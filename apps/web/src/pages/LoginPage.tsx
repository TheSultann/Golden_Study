import { Eye, EyeOff, GraduationCap, Moon, Sun } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { login as loginWithApi } from '../features/auth/auth.service'
import { formatApiError } from '../shared/api/errorTranslation'

export function LoginPage() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dark, setDark] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginWithApi({ login, password })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(formatApiError(caught, 'Login yoki parol noto‘g‘ri'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page" data-theme={dark ? 'dark' : 'light'}>
      <button className="theme-toggle" type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Yorug‘ mavzu' : 'Tungi mavzu'}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <section className="login-shell" aria-labelledby="login-title">
        <header className="brand">
          <span className="brand-mark"><GraduationCap size={24} /></span>
          <span>Golden Study CRM</span>
        </header>

        <div className="login-card">
          <div className="login-heading">
            <h1 id="login-title">Tizimga kirish</h1>
            <p>Hisobingiz ma’lumotlarini kiriting</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="login">Login</label>
              <input id="login" autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Loginni kiriting" />
            </div>

            <div className="field">
              <label htmlFor="password">Parol</label>
              <div className="password-field">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Parolni kiriting" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Kirilmoqda...' : 'Kirish'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
