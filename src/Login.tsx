import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { ApiError } from './api/client'
import { googleLogin, login, register } from './api/authService'
import { useDialogFocus } from './hooks/useDialogFocus'

type TurnstileWidgetId = string | number
type GoogleCredentialResponse = { credential?: string }

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
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
          renderButton: (parent: HTMLElement, options: {
            type: 'standard'
            theme: 'outline'
            size: 'large'
            text: 'signin_with' | 'signup_with'
            shape: 'rectangular'
            logo_alignment: 'left'
            width: number
          }) => void
        }
      }
    }
  }
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
let googleScriptPromise: Promise<void> | null = null

type AuthMode = 'login' | 'register'

interface LoginProps {
  onClose: () => void
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.parkoGoogleIdentity = 'true'
    script.onload = () => {
      if (window.google?.accounts.id) resolve()
      else {
        googleScriptPromise = null
        reject(new Error('Google Identity Services did not initialize'))
      }
    }
    script.onerror = () => {
      googleScriptPromise = null
      reject(new Error('Google Identity Services failed to load'))
    }
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export default function Login({ onClose }: LoginProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const googleCredentialHandlerRef = useRef<(credential: string) => void>(() => undefined)
  const googleInitializedRef = useRef(false)
  useDialogFocus(dialogRef)
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
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

  const handleGoogleCredential = async (credential: string) => {
    setError('')
    setGoogleError('')
    if (mode === 'register' && !acceptedTerms) {
      setError('Prano Kushtet e Përdorimit dhe Politikën e Privatësisë para se të krijosh llogari.')
      return
    }
    setGoogleLoading(true)
    try {
      const tokens = await googleLogin(credential, mode)
      if (tokens.user.role === 'ADMIN') {
        const url = new URL(window.location.href)
        url.searchParams.set('view', 'dashboard')
        window.history.replaceState({}, '', url)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
      onClose()
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : 'Hyrja me Google dështoi. Provo përsëri.')
    } finally {
      setGoogleLoading(false)
    }
  }

  googleCredentialHandlerRef.current = (credential) => { void handleGoogleCredential(credential) }

  useEffect(() => {
    if (!googleClientId || Capacitor.isNativePlatform() || !googleButtonRef.current) return
    let cancelled = false

    void loadGoogleIdentityScript().then(() => {
      const parent = googleButtonRef.current
      if (cancelled || !parent || !window.google) return
      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response.credential) googleCredentialHandlerRef.current(response.credential)
            else setError('Google nuk ktheu kredencialet e hyrjes. Provo përsëri.')
          },
        })
        googleInitializedRef.current = true
      }
      parent.replaceChildren()
      window.google.accounts.id.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.max(220, Math.min(360, Math.floor(parent.getBoundingClientRect().width))),
      })
      setGoogleReady(true)
      setGoogleError('')
    }).catch(() => {
      if (!cancelled) setGoogleError('Nuk u ngarkua hyrja me Google. Kontrollo lidhjen dhe provo përsëri.')
    })

    return () => {
      cancelled = true
      setGoogleReady(false)
      googleButtonRef.current?.replaceChildren()
    }
  }, [mode])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Plotëso emailin dhe fjalëkalimin.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Vendos një adresë emaili të vlefshme.')
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError('Përfundo verifikimin e sigurisë para se të vazhdosh.')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Fjalëkalimet nuk përputhen.')
      return
    }
    if (mode === 'register' && (password.length < 12 || password.length > 128)) {
      setError('Fjalëkalimi duhet të ketë 12–128 karaktere.')
      return
    }
    if (mode === 'register' && !/^[a-zA-Z0-9_]{3,40}$/.test(username.trim())) {
      setError('Emri i përdoruesit duhet të ketë 3–40 karaktere: shkronja, numra ose _.')
      return
    }
    if (mode === 'register' && !acceptedTerms) {
      setError('Duhet t’i pranosh Kushtet dhe Politikën e Privatësisë.')
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
          setError('Plotëso emrin dhe emrin e përdoruesit.')
          return
        }
        await register({ name: name.trim(), username: username.trim(), email: email.trim(), password, ...(turnstileSiteKey ? { turnstileToken } : {}) })
        onClose()
      }
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : 'Nuk mund të lidhemi me serverin. Provo përsëri.')
    } finally {
      setIsLoading(false)
      if (turnstileSiteKey) resetTurnstile()
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <style>{`
        .login-modal-overlay {
          position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center;
          justify-content: center; overflow-y: auto; padding: 16px;
          background: rgba(13, 24, 37, .56); backdrop-filter: blur(5px);
        }
        .login-modal-overlay .login-modal {
          position: relative; width: min(100%, 430px); max-height: calc(100vh - 32px);
          max-height: calc(100dvh - 32px); overflow-y: auto; padding: 28px;
          border: 1px solid #e3e9ef; border-radius: 8px; background: #fff;
          box-shadow: 0 22px 64px rgba(16, 32, 48, .24); animation: login-in .18s ease-out;
        }
        @keyframes login-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .login-close-btn {
          position: absolute; top: 14px; right: 14px; display: grid; width: 44px; height: 44px;
          place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent;
          color: #667588; font-size: 23px; cursor: pointer;
        }
        .login-close-btn:hover { background: #f2f5f8; color: #1d2b3a; }
        .login-header { display: flex; align-items: center; gap: 12px; margin: 0 38px 22px 0; text-align: left; }
        .login-brand-mark { display: grid; flex: 0 0 40px; width: 40px; height: 40px; place-items: center; border-radius: 8px; background: #e8f0fe; color: #2563eb; font-size: 21px; font-weight: 800; }
        .login-brand-copy { min-width: 0; }
        .login-brand-name { margin: 0; color: #1c2a39; font-size: 16px; font-weight: 750; }
        .login-title { margin: 2px 0 0; color: #435367; font-size: 13px; font-weight: 500; }
        .login-tabs { display: flex; gap: 20px; margin-bottom: 18px; border-bottom: 1px solid #e4e9ef; }
        .login-tab { min-height: 42px; padding: 0 5px 10px; border: 0; border-bottom: 2px solid transparent; background: none; color: #67778a; font-size: 14px; font-weight: 650; cursor: pointer; }
        .login-tab.active { border-bottom-color: #2563eb; color: #1d5fd2; }
        .google-login-area { margin-bottom: 18px; }
        .google-button-host { display: flex; min-height: 44px; justify-content: center; width: 100%; }
        .google-button-host > div { max-width: 100%; }
        .google-login-area--busy { opacity: .65; pointer-events: none; }
        .google-auth-note { margin: 0; padding: 10px 12px; border: 1px solid #e4e9ef; border-radius: 6px; color: #65758a; background: #f7f9fb; font-size: 12px; line-height: 1.45; }
        .login-divider { display: flex; align-items: center; gap: 12px; margin: 0 0 18px; color: #7a8796; font-size: 11px; font-weight: 650; }
        .login-divider::before, .login-divider::after { flex: 1; height: 1px; background: #e5eaf0; content: ''; }
        .login-form { display: flex; flex-direction: column; gap: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { color: #26374a; font-size: 13px; font-weight: 650; }
        .form-input { box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #d9e1e9; border-radius: 6px; background: #fff; color: #142536; font: inherit; font-size: 14px; }
        .form-input:focus { outline: 2px solid rgba(37, 99, 235, .2); border-color: #2563eb; }
        .form-input::placeholder { color: #8996a5; }
        .password-input-wrap { position: relative; }
        .password-input-wrap .form-input { padding-right: 48px; }
        .password-toggle { position: absolute; top: 50%; right: 8px; display: grid; width: 32px; height: 32px; place-items: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #67778a; cursor: pointer; transform: translateY(-50%); }
        .password-toggle:hover { background: #f2f5f8; }
        .error-message { margin: 0; padding: 10px 12px; border: 1px solid #f3b8b7; border-radius: 6px; background: #fff1f0; color: #a52b27; font-size: 13px; line-height: 1.45; }
        .login-button { min-height: 46px; margin-top: 2px; padding: 11px 16px; border: 0; border-radius: 6px; background: #2563eb; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .login-button:hover:not(:disabled) { background: #1e55cf; }
        .login-button:disabled { opacity: .6; cursor: not-allowed; }
        .legal-consent { display: flex; align-items: flex-start; gap: 9px; color: #56677a; font-size: 12px; line-height: 1.5; }
        .legal-consent--before-google { margin: 0 0 16px; }
        .legal-consent input { margin: 3px 0 0; accent-color: #2563eb; }
        .legal-consent a, .login-legal a { color: #1d5fd2; text-decoration: underline; text-underline-offset: 2px; }
        .login-legal { margin: 18px 0 0; color: #7a8796; font-size: 11px; line-height: 1.5; text-align: center; }
        @media (max-width: 480px) {
          .login-modal-overlay { align-items: center; padding: 12px; }
          .login-modal-overlay .login-modal { padding: 24px 20px; max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); }
        }
        @media (prefers-reduced-motion: reduce) { .login-modal-overlay .login-modal { animation: none; } }
      `}</style>

      <div className="login-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="login-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="login-close-btn" onClick={onClose} aria-label="Mbyll hyrjen">×</button>

        <header className="login-header">
          <div className="login-brand-mark" aria-hidden="true">P</div>
          <div className="login-brand-copy">
            <p className="login-brand-name">Parko</p>
            <h2 className="login-title" id="login-title">{mode === 'login' ? 'Hyr në llogarinë tënde' : 'Krijo llogari në Parko'}</h2>
          </div>
        </header>

        <div className="login-tabs" aria-label="Veprimi i llogarisë">
          <button type="button" aria-pressed={mode === 'login'} className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>Hyr</button>
          <button type="button" aria-pressed={mode === 'register'} className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>Regjistrohu</button>
        </div>

        {mode === 'register' && <label className="legal-consent legal-consent--before-google">
          <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} disabled={isLoading || googleLoading} required />
          <span>Pranoj <a href="/terms" target="_blank" rel="noreferrer">Kushtet e Përdorimit</a> dhe <a href="/privacy" target="_blank" rel="noreferrer">Politikën e Privatësisë</a>.</span>
        </label>}

        <div className={`google-login-area${googleLoading ? ' google-login-area--busy' : ''}`} aria-busy={googleLoading}>
          {Capacitor.isNativePlatform() ? (
            <p className="google-auth-note">Hyrja me Google është e disponueshme në web. Në aplikacion përdor hyrjen me email.</p>
          ) : mode === 'register' && !acceptedTerms ? (
            <p className="google-auth-note" role="status">Prano kushtet më sipër për të vazhduar me Google.</p>
          ) : !googleClientId ? (
            <p className="google-auth-note" role="status">Hyrja me Google aktivizohet sapo të konfigurohet OAuth Client ID.</p>
          ) : (
            <>
              <div ref={googleButtonRef} className="google-button-host" aria-label={mode === 'login' ? 'Hyr me Google' : 'Regjistrohu me Google'} />
              {googleError && <p className="google-auth-note" role="status">{googleError}</p>}
              {googleLoading && <p className="google-auth-note" role="status">Duke verifikuar llogarinë Google…</p>}
              {!googleReady && !googleError && <p className="google-auth-note" role="status">Duke ngarkuar hyrjen me Google…</p>}
            </>
          )}
        </div>

        <div className="login-divider" aria-hidden="true">OSE VAZHDO ME EMAIL</div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message" role="alert">{error}</div>}

          {mode === 'register' && <>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Emri</label>
              <input id="name" className="form-input" value={name} onChange={(event) => setName(event.target.value)} disabled={isLoading || googleLoading} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Emri i përdoruesit</label>
              <input id="username" className="form-input" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))} disabled={isLoading || googleLoading} autoComplete="username" required />
            </div>
          </>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" placeholder="emri@shembull.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading || googleLoading} autoComplete="email" required />
          </div>

          {turnstileSiteKey && <div ref={turnstileContainerRef} aria-label="Verifikimi i sigurisë" />}

          <div className="form-group">
            <label className="form-label" htmlFor="password">Fjalëkalimi</label>
            <div className="password-input-wrap">
              <input id="password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="Fjalëkalimi" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isLoading || googleLoading} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>
                {showPassword ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 4.5 10 8-.3 1.3-1 2.7-2 3.9M6.2 6.2C4.4 7.7 3.3 9.8 3 12c.7 3.5 4.5 8 9 8 1.3 0 2.5-.3 3.6-.8" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12s3.3-8 9-8 9 8 9 8-3.3 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
          </div>

          {mode === 'register' && <>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Konfirmo fjalëkalimin</label>
              <div className="password-input-wrap">
                <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} className="form-input" placeholder="Konfirmo fjalëkalimin" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isLoading || googleLoading} required />
                <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>
                  {showConfirmPassword ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9.3 4.5 10 8-.3 1.3-1 2.7-2 3.9M6.2 6.2C4.4 7.7 3.3 9.8 3 12c.7 3.5 4.5 8 9 8 1.3 0 2.5-.3 3.6-.8" /></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12s3.3-8 9-8 9 8 9 8-3.3 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              </div>
            </div>
          </>}

          <button type="submit" className="login-button" disabled={isLoading || googleLoading || (mode === 'register' && !acceptedTerms)}>
            {isLoading ? 'Duke pritur…' : mode === 'login' ? 'Hyr me email' : 'Krijo llogari'}
          </button>
        </form>

        <p className="login-legal">Duke vazhduar, përdorimi yt i Parko-s rregullohet nga <a href="/terms" target="_blank" rel="noreferrer">Kushtet</a> dhe <a href="/privacy" target="_blank" rel="noreferrer">Privatësia</a>.</p>
      </div>
    </div>
  )
}
