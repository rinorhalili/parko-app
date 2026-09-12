import { useEffect, useRef, useState } from 'react'
import { ApiError } from './api/client'
import { login, register } from './api/authService'

type TurnstileWidgetId = string | number

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback': () => void
        'error-callback': () => void
      }) => TurnstileWidgetId
      reset: (widgetId?: TurnstileWidgetId) => void
      remove: (widgetId: TurnstileWidgetId) => void
    }
  }
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()

type AuthMode = 'login' | 'register'

interface LoginProps {
  onClose: () => void
}

export default function Login({ onClose }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetRef = useRef<TurnstileWidgetId | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return

    let cancelled = false
    let retryTimer: number | undefined
    let attempts = 0
    const renderWidget = () => {
      if (cancelled || !turnstileContainerRef.current) return
      if (!window.turnstile) {
        attempts += 1
        if (attempts >= 100) {
          setError('Verifikimi i sigurisë nuk u ngarkua. Rifresko faqen dhe provo përsëri.')
          return
        }
        retryTimer = window.setTimeout(renderWidget, 50)
        return
      }
      turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      })
    }

    renderWidget()
    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
      if (turnstileWidgetRef.current !== null) window.turnstile?.remove(turnstileWidgetRef.current)
      turnstileWidgetRef.current = null
    }
  }, [])

  const resetTurnstile = () => {
    setTurnstileToken('')
    if (turnstileWidgetRef.current !== null) window.turnstile?.reset(turnstileWidgetRef.current)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ju lutem vendosni një adresë emaili të vlefshme.')
      return
    }

    if (turnstileSiteKey && !turnstileToken) {
      setError('Përfundo verifikimin e sigurisë para se të vazhdosh.')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (mode === 'register' && (password.length < 12 || password.length > 128)) {
      setError('Fjalëkalimi duhet të ketë 12–128 karaktere.')
      return
    }
    if (mode === 'register' && !/^[a-zA-Z0-9_]{3,40}$/.test(username.trim())) {
      setError('Username duhet të ketë 3–40 karaktere: shkronja, numra ose _.')
      return
    }

    setIsLoading(true)
    try {
      if (mode === 'login') {
        const tokens = await login({ email: email.trim(), password, ...(turnstileSiteKey ? { turnstileToken } : {}) })
        if (tokens.user.role === 'ADMIN') {
          const url = new URL(window.location.href)
          url.searchParams.set('view', 'dashboard')
          window.history.replaceState({}, '', url)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }
        onClose()
      } else {
        if (!name.trim() || !username.trim()) {
          setError('Please add your name and username')
          return
        }
        await register({ name: name.trim(), username: username.trim(), email: email.trim(), password, ...(turnstileSiteKey ? { turnstileToken } : {}) })
        onClose()
      }
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : 'Unable to reach the Parko server. Please try again.')
    } finally {
      setIsLoading(false)
      if (turnstileSiteKey) resetTurnstile()
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <style>{`
        .login-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .login-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          width: 100%;
          max-width: 400px;
          animation: slideUp 0.3s ease-out;
          max-height: 90vh;
          overflow-y: auto;
        }

        .login-modal::-webkit-scrollbar {
          width: 6px;
        }

        .login-modal::-webkit-scrollbar-track {
          background: var(--surface-soft);
          border-radius: 10px;
        }

        .login-modal::-webkit-scrollbar-thumb {
          background: var(--muted);
          border-radius: 10px;
        }

        .login-modal::-webkit-scrollbar-thumb:hover {
          background: var(--ink);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--muted);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .login-close-btn:hover {
          background: var(--surface-soft);
          color: var(--ink);
        }

        .login-modal {
          position: relative;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 8px 0;
        }

        .login-tabs {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--line);
        }

        .login-tab {
          padding: 12px 16px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
          position: relative;
          bottom: -1px;
        }

        .login-tab.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }

        .form-input {
          padding: 12px 16px;
          border: 1px solid var(--line);
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent);
        }

        .form-input::placeholder {
          color: var(--muted);
        }

        .error-message {
          padding: 12px 16px;
          background: #fed7d7;
          border: 1px solid #fc8181;
          border-radius: 8px;
          color: #c53030;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .login-button {
          padding: 12px 24px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 8px;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px color-mix(in srgb, var(--primary) 30%, transparent);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .password-input-wrap { position: relative; }
        .password-input-wrap .form-input { box-sizing: border-box; width: 100%; padding-right: 48px; }
        .password-toggle { position: absolute; top: 50%; right: 12px; display: grid; width: 24px; height: 24px; padding: 0; border: 0; background: transparent; color: var(--muted); cursor: pointer; transform: translateY(-50%); place-items: center; }
      `}</style>

      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-close-btn" onClick={onClose}>×</button>

        <div className="login-header">
          <h2 className="login-title">Parko</h2>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            Log In
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            Register
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          {mode === 'register' && <>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Name</label>
              <input id="name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input id="username" className="form-input" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} disabled={isLoading} autoComplete="username" required />
            </div>
          </>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          {turnstileSiteKey && <div ref={turnstileContainerRef} aria-label="Verifikimi i sigurisë" />}

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>
                {showPassword ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 4.5 10 8-.3 1.3-1 2.7-2 3.9M6.2 6.2C4.4 7.7 3.3 9.8 3 12c.7 3.5 4.5 8 9 8 1.3 0 2.5-.3 3.6-.8" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12s3.3-8 9-8 9 8 9 8-3.3 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-wrap">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>
                  {showConfirmPassword ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 4.5 10 8-.3 1.3-1 2.7-2 3.9M6.2 6.2C4.4 7.7 3.3 9.8 3 12c.7 3.5 4.5 8 9 8 1.3 0 2.5-.3 3.6-.8" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12s3.3-8 9-8 9 8 9 8-3.3 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}
