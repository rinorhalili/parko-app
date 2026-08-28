import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MapCoordinate, Parking } from './types'

export type LiveDeparture = {
  id: string
  parkingId: string
  coordinates: MapCoordinate
  minutes: number
  createdAt: number
  expiresAt: number
}

export type StreetAlert = {
  id: string
  kind: 'police' | 'spider'
  street: string
  zone: string
  createdAt: number
  expiresAt: number
}

type CrowdContextValue = {
  departures: LiveDeparture[]
  alerts: StreetAlert[]
  vouches: Record<string, { status: 'free' | 'taken'; verifiedAt: number }>
  broadcastDeparture: (parking: Parking, minutes: number) => void
  vouchSpot: (parkingId: string, status: 'free' | 'taken') => void
  reportAlert: (kind: StreetAlert['kind'], street: string, zone: string) => void
}

const CrowdSourcingContext = createContext<CrowdContextValue | null>(null)
const STORAGE_KEY = 'parko-crowd-sourcing'
const DEPARTURE_TTL = 30 * 60_000
const ALERT_TTL = 45 * 60_000

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<CrowdContextValue>
    return {
      departures: Array.isArray(parsed.departures) ? parsed.departures : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      vouches: parsed.vouches && typeof parsed.vouches === 'object' ? parsed.vouches : {},
    }
  } catch {
    return { departures: [], alerts: [], vouches: {} }
  }
}

export function CrowdSourcingProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadState, [])
  const [departures, setDepartures] = useState<LiveDeparture[]>(initial.departures)
  const [alerts, setAlerts] = useState<StreetAlert[]>(initial.alerts)
  const [vouches, setVouches] = useState<CrowdContextValue['vouches']>(initial.vouches)

  useEffect(() => {
    const prune = () => {
      const now = Date.now()
      setDepartures((items) => items.filter((item) => item.expiresAt > now))
      setAlerts((items) => items.filter((item) => item.expiresAt > now))
    }
    prune()
    const interval = window.setInterval(prune, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ departures, alerts, vouches })) } catch { /* storage may be unavailable */ }
  }, [departures, alerts, vouches])

  const value = useMemo<CrowdContextValue>(() => ({
    departures,
    alerts,
    vouches,
    broadcastDeparture: (parking, minutes) => {
      const now = Date.now()
      setDepartures((current) => [
        ...current.filter((item) => item.parkingId !== parking.id),
        { id: `${parking.id}-${now}`, parkingId: parking.id, coordinates: parking.coordinates, minutes, createdAt: now, expiresAt: now + DEPARTURE_TTL },
      ])
    },
    vouchSpot: (parkingId, status) => setVouches((current) => ({ ...current, [parkingId]: { status, verifiedAt: Date.now() } })),
    reportAlert: (kind, street, zone) => {
      const now = Date.now()
      setAlerts((current) => [
        ...current,
        { id: `${kind}-${now}`, kind, street: street.trim() || 'Rruga e zgjedhur', zone: zone.trim() || 'Zona e zgjedhur', createdAt: now, expiresAt: now + ALERT_TTL },
      ])
    },
  }), [alerts, departures, vouches])

  return <CrowdSourcingContext.Provider value={value}>{children}</CrowdSourcingContext.Provider>
}

export function useCrowdSourcing() {
  const context = useContext(CrowdSourcingContext)
  if (!context) throw new Error('useCrowdSourcing must be used inside CrowdSourcingProvider')
  return context
}

export function relativeVerifiedTime(timestamp?: number) {
  if (!timestamp) return 'Pa verifikim'
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  return minutes < 1 ? 'Verified tani' : `Verified ${minutes} min ago`
}

export function SpotVouching({ parking }: { parking: Parking }) {
  const { vouches, vouchSpot } = useCrowdSourcing()
  const vouch = vouches[parking.id]
  const [, setClock] = useState(Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  return (
    <section className="crowd-card" aria-label="Verifiko disponueshmërinë">
      <header><span><small>Komuniteti</small><strong>{vouch?.status === 'taken' ? 'Raportuar i zënë' : vouch?.status === 'free' ? 'Raportuar ende i lirë' : 'A është ende i lirë?'}</strong></span><b>{relativeVerifiedTime(vouch?.verifiedAt)}</b></header>
      <div className="crowd-card__actions">
        <button className={vouch?.status === 'free' ? 'selected' : ''} onClick={() => vouchSpot(parking.id, 'free')} aria-pressed={vouch?.status === 'free'}>+1 / Still Free</button>
        <button className={vouch?.status === 'taken' ? 'selected crowd-card__taken' : ''} onClick={() => vouchSpot(parking.id, 'taken')} aria-pressed={vouch?.status === 'taken'}>Taken</button>
      </div>
    </section>
  )
}

export function LeavingButton({ parking }: { parking: Parking }) {
  const { departures, broadcastDeparture } = useCrowdSourcing()
  const active = departures.find((departure) => departure.parkingId === parking.id)
  const [minutes, setMinutes] = useState(5)
  return (
    <section className="crowd-card crowd-card--leaving" aria-label="Njofto se po largohesh">
      <header><span><small>Ndihmo komunitetin</small><strong>Po largohesh?</strong></span><b>{active ? `Live · ${active.minutes} min` : 'Pin i përkohshëm'}</b></header>
      <div className="crowd-card__leaving">
        <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="Minutat deri në largim">
          {[5, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value} min</option>)}
        </select>
        <button onClick={() => broadcastDeparture(parking, minutes)}>{active ? 'Përditëso' : "I'm Leaving"}</button>
      </div>
    </section>
  )
}

export function StreetAlertFab({ defaultZone = '' }: { defaultZone?: string }) {
  const { reportAlert } = useCrowdSourcing()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<StreetAlert['kind']>('police')
  const [street, setStreet] = useState('')
  const [zone, setZone] = useState(defaultZone)
  return (
    <>
      <button className="crowd-fab" onClick={() => setOpen(true)} aria-label="Raporto polici ose merimangë">⚠</button>
      {open && <div className="crowd-alert-dialog-backdrop" role="presentation">
        <section className="crowd-alert-dialog" role="dialog" aria-modal="true" aria-labelledby="crowd-alert-title">
          <header><span><small>Raportim live</small><strong id="crowd-alert-title">Çfarë po ndodh?</strong></span><button onClick={() => setOpen(false)} aria-label="Mbyll">×</button></header>
          <div className="crowd-alert-types">
            <button className={kind === 'police' ? 'selected' : ''} onClick={() => setKind('police')} aria-pressed={kind === 'police'}>🚔 Polici</button>
            <button className={kind === 'spider' ? 'selected' : ''} onClick={() => setKind('spider')} aria-pressed={kind === 'spider'}>🕷 Merimangë</button>
          </div>
          <label>Rruga<input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="p.sh. Garibaldi" /></label>
          <label>Zona<input value={zone} onChange={(event) => setZone(event.target.value)} placeholder="p.sh. Qendër" /></label>
          <button className="button button--wide" onClick={() => { reportAlert(kind, street, zone); setOpen(false); setStreet('') }}>Dërgo raportimin</button>
        </section>
      </div>}
    </>
  )
}

export function AlertBanner({ zone }: { zone: string }) {
  const { alerts } = useCrowdSourcing()
  const nearby = alerts.filter((alert) => alert.zone.toLowerCase() === zone.toLowerCase()).slice(-2)
  if (!nearby.length) return null
  return <aside className="crowd-alert-banner" role="status"><strong>⚠ Kujdes në {zone}</strong>{nearby.map((alert) => <span key={alert.id}>{alert.kind === 'police' ? 'Polici' : 'Merimangë'} në {alert.street} · tani</span>)}</aside>
}
