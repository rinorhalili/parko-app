import { lazy, StrictMode, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import { CrowdSourcingProvider } from './crowdsourcing'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import { initTelemetry } from './telemetry'

initTelemetry()
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

type AppMode = 'app' | 'dashboard'
const AdminDashboard = lazy(() => import('./AdminDashboard'))

declare global {
  interface Window {
    __parkoReactRoot?: Root
  }
}

function resolveInitialMode(): AppMode {
  const params = new URLSearchParams(window.location.search)
  const urlMode = params.get('view')
  if (urlMode === 'app' || urlMode === 'dashboard') {
    return urlMode
  }

  const adminFlag = params.get('admin')
  if (adminFlag === '1' || adminFlag === 'true') {
    return 'dashboard'
  }

  const pathname = window.location.pathname.replace(/\/+$/, '')
  if (pathname.endsWith('/admin') || pathname.endsWith('/dashboard')) {
    return 'dashboard'
  }

  return window.electronAPI ? 'dashboard' : 'app'
}

function AppRouter() {
  const mode = resolveInitialMode()

  return (
    <>
      {mode === 'dashboard' ? <Suspense fallback={<div className="app-loading" role="status">Duke hapur panelin…</div>}><AdminDashboard /></Suspense> : <App />}
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
