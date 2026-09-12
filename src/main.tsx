import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import { CrowdSourcingProvider } from './crowdsourcing'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import { initTelemetry } from './telemetry'
import { restoreSession } from './api/client'

initTelemetry()
// A page reload obtains a fresh short-lived access token from the HTTP-only
// refresh cookie; no refresh credential is persisted in browser storage.
// Browsing the map remains possible while the account service is unreachable.
void restoreSession().catch(() => undefined)
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalDevelopment) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      return
    }
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}

type AppMode = 'app' | 'dashboard' | 'privacy'
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy'))

declare global {
  interface Window {
    __parkoReactRoot?: Root
  }
}

function resolveInitialMode(): AppMode {
  const params = new URLSearchParams(window.location.search)
  const urlMode = params.get('view')
  if (urlMode === 'app' || urlMode === 'dashboard' || urlMode === 'privacy') {
    return urlMode
  }

  const adminFlag = params.get('admin')
  if (adminFlag === '1' || adminFlag === 'true') {
    return 'dashboard'
  }

  const pathname = window.location.pathname.replace(/\/+$/, '')
  if (pathname.endsWith('/privacy')) {
    return 'privacy'
  }
  if (pathname.endsWith('/admin') || pathname.endsWith('/dashboard')) {
    return 'dashboard'
  }

  return window.electronAPI ? 'dashboard' : 'app'
}

function AppRouter() {
  const [mode, setMode] = useState(resolveInitialMode)
  useEffect(() => {
    const update = () => setMode(resolveInitialMode())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  return (
    <>
      {mode === 'dashboard' ? <Suspense fallback={<div className="app-loading" role="status">Duke hapur panelin…</div>}><AdminDashboard /></Suspense> : mode === 'privacy' ? <Suspense fallback={<div className="app-loading" role="status">Duke hapur politikën…</div>}><PrivacyPolicy /></Suspense> : <App />}
    </>
  )
}

const rootElement = document.getElementById('root')!
const root = window.__parkoReactRoot ?? createRoot(rootElement)
window.__parkoReactRoot = root
root.render(
  <StrictMode>
    <CrowdSourcingProvider>
      <AppRouter />
    </CrowdSourcingProvider>
  </StrictMode>,
)
