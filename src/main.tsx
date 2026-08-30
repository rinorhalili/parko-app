import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import { CrowdSourcingProvider } from './crowdsourcing'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import './styles.css'
import { initTelemetry } from './telemetry'

initTelemetry()
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined))
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

  const savedMode = window.localStorage.getItem('parko-app-mode')
  if (savedMode === 'app' || savedMode === 'dashboard') {
    return savedMode
  }

  return navigator.userAgent.includes('Electron') ? 'dashboard' : 'app'
}

function AppModeSwitcher() {
  const [mode, setMode] = useState<AppMode>(resolveInitialMode)

  useEffect(() => {
    window.localStorage.setItem('parko-app-mode', mode)
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('view', mode)
    window.history.replaceState({}, '', nextUrl)
  }, [mode])

  return (
    <>
      <style>{`
        .parko-app-mode-switcher {
          position: fixed;
          z-index: 2000;
          top: 16px;
          right: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.32);
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
        }

        .parko-app-mode-switcher button {
          border: none;
          background: transparent;
          color: #e2e8f0;
          cursor: pointer;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 700;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .parko-app-mode-switcher button.active {
          background: rgba(96, 165, 250, 0.22);
          color: white;
        }

        @media (max-width: 520px) {
          .parko-app-mode-switcher { display: none; }
        }
      `}</style>

      <div className="parko-app-mode-switcher" aria-label="Application view switcher">
        <button type="button" className={mode === 'app' ? 'active' : ''} onClick={() => setMode('app')}>
          Main page
        </button>
        <button type="button" className={mode === 'dashboard' ? 'active' : ''} onClick={() => setMode('dashboard')}>
          Admin dashboard
        </button>
      </div>

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
      <AppModeSwitcher />
    </CrowdSourcingProvider>
  </StrictMode>,
)
