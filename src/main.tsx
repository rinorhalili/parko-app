import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import './styles.css'
import { initTelemetry } from './telemetry'

initTelemetry()
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
