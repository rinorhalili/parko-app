import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Router from './router'
import { CrowdSourcingProvider } from './crowdsourcing'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import './product-ui.css'
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

declare global {
  interface Window {
    __parkoReactRoot?: Root
  }
}

const rootElement = document.getElementById('root')!
const root = window.__parkoReactRoot ?? createRoot(rootElement)
window.__parkoReactRoot = root
root.render(
  <StrictMode>
    <CrowdSourcingProvider>
      <Router />
    </CrowdSourcingProvider>
  </StrictMode>,
)
