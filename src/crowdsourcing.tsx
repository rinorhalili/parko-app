import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadCommunityState, submitParkingAvailability, type CommunityParkingReport, type CommunityStreetAlert } from './communityApi'
import { supabase } from './lib/supabase'
import type { Parking } from './types'

type CrowdContextValue = {
  reports: CommunityParkingReport[]
  alerts: CommunityStreetAlert[]
  error: string | null
  vouchSpot: (parking: Parking, status: 'free' | 'taken') => Promise<void>
}
const CrowdSourcingContext = createContext<CrowdContextValue | null>(null)

export function CrowdSourcingProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<CommunityParkingReport[]>([])
  const [alerts, setAlerts] = useState<CommunityStreetAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const refresh = () => loadCommunityState().then((state) => {
      if (active) { setReports(state.reports); setAlerts(state.alerts) }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Raportimet e komunitetit nuk u ngarkuan.')
    })
    void refresh()
    const channel = supabase.channel('community-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_parking_reports' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'street_alerts' }, () => void refresh())
      .subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [])
  const value = useMemo<CrowdContextValue>(() => ({ reports, alerts, error,
    vouchSpot: async (parking, status) => {
      setError(null)
      try {
        const report = await submitParkingAvailability(parking, status === 'free' ? 'AVAILABLE' : 'OCCUPIED')
        setReports((current) => [report, ...current.filter((item) => item.parkingId !== report.parkingId)])
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Raportimi nuk u dërgua.'
        setError(message)
        throw new Error(message)
      }
    },
  }), [alerts, error, reports])
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
  return minutes < 1 ? 'Verifikuar tani' : `Verifikuar ${minutes} min më parë`
}

export function SpotVouching({ parking }: { parking: Parking }) {
  const { reports, vouchSpot, error } = useCrowdSourcing()
  const report = reports.find((item) => item.parkingId === parking.id)
  const [sending, setSending] = useState(false)
  const submit = async (status: 'free' | 'taken') => {
    setSending(true)
    try { await vouchSpot(parking, status) } catch { /* error is rendered below */ } finally { setSending(false) }
  }
  const free = report?.status === 'AVAILABLE'
  return <section className="crowd-card" aria-label="Verifiko disponueshmërinë">
    <header><span><small>Komuniteti · live</small><strong>{report ? (free ? 'Raportuar ende i lirë' : 'Raportuar i zënë') : 'A është ende i lirë?'}</strong></span><b>{relativeVerifiedTime(report?.createdAt)}</b></header>
    <div className="crowd-card__actions">
      <button className={free ? 'selected' : ''} disabled={sending} onClick={() => void submit('free')} aria-pressed={free}>+1 / Still Free</button>
      <button className={report?.status === 'OCCUPIED' ? 'selected crowd-card__taken' : ''} disabled={sending} onClick={() => void submit('taken')} aria-pressed={report?.status === 'OCCUPIED'}>Taken</button>
    </div>
    {error && <small className="crowd-card__error" role="alert">{error}</small>}
  </section>
}

export function LeavingButton({ parking }: { parking: Parking }) {
  return <section className="crowd-card crowd-card--leaving" aria-label="Raporto një vend të lirë">
    <header><span><small>Ndihmo komunitetin</small><strong>Po largohesh?</strong></span><b>Raport live</b></header>
    <SpotVouching parking={parking} />
  </section>
}

export function AlertBanner({ zone }: { zone: string }) {
  const { alerts } = useCrowdSourcing()
  const nearby = alerts.filter((alert) => alert.zone.toLowerCase() === zone.toLowerCase()).slice(0, 2)
  if (!nearby.length) return null
  return <aside className="crowd-alert-banner" role="status"><strong>⚠ Kujdes në {zone}</strong>{nearby.map((alert) => <span key={alert.id}>{alert.kind === 'police' ? 'Polici' : 'Merimangë'} në {alert.street} · tani</span>)}</aside>
}
