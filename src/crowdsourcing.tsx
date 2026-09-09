import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadCommunityState, submitParkingObservation, type CommunityParkingReport, type ParkingObservation } from './communityApi'
import { useSocket } from './hooks/useSocket'
import type { Parking } from './types'

type CrowdContextValue = {
  reports: CommunityParkingReport[]
  error: string | null
  submitReport: (parking: Parking, observation: ParkingObservation) => Promise<CommunityParkingReport>
  vouchSpot: (parking: Parking, status: 'free' | 'taken') => Promise<void>
}

const CrowdSourcingContext = createContext<CrowdContextValue | null>(null)

function replaceLatestReport(current: CommunityParkingReport[], next: CommunityParkingReport) {
  return [next, ...current.filter((item) => item.parkingId !== next.parkingId)]
}

export function CrowdSourcingProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<CommunityParkingReport[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setReports((current) => current.filter((report) => report.expiresAt > Date.now())), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => loadCommunityState()
      .then((state) => { if (active) setReports(state.reports) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Raportimet e komunitetit nuk u ngarkuan.')
      })
    void refresh()
    return () => { active = false }
  }, [])

  useSocket({ onParkingReport: (report) => {
    const next: CommunityParkingReport = {
      id: report.id,
      parkingId: report.parkingSpotId,
      status: report.status,
      ...(report.status === 'AVAILABLE' ? { availability: 'free-spots' as const } : report.status === 'OCCUPIED' ? { availability: 'full' as const } : {}),
      ...(report.payment ? { payment: report.payment === 'FREE' ? 'free' as const : 'paid' as const } : {}),
      ...(report.policeRisk === null ? {} : { policeRisk: report.policeRisk }),
      createdAt: Date.parse(report.createdAt),
      updatedAt: Date.parse(report.createdAt),
      expiresAt: Date.parse(report.expiresAt),
    }
    setReports((current) => replaceLatestReport(current, next))
  } })

  const submitReport = useCallback(async (parking: Parking, observation: ParkingObservation) => {
    setError(null)
    try {
      const report = await submitParkingObservation(parking, observation)
      setReports((current) => replaceLatestReport(current, report))
      return report
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Raportimi nuk u dergua.'
      setError(message)
      throw new Error(message)
    }
  }, [])

  const value = useMemo<CrowdContextValue>(() => ({
    reports,
    error,
    submitReport,
    vouchSpot: async (parking, status) => {
      await submitReport(parking, { availability: status === 'free' ? 'AVAILABLE' : 'OCCUPIED' })
    },
  }), [error, reports, submitReport])

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
  return minutes < 1 ? 'Verifikuar tani' : `Verifikuar ${minutes} min me pare`
}

export function SpotVouching({ parking }: { parking: Parking }) {
  const { reports, vouchSpot, error } = useCrowdSourcing()
  const report = reports.find((item) => item.parkingId === parking.id)
  const [sending, setSending] = useState(false)
  const submit = async (status: 'free' | 'taken') => {
    setSending(true)
    try { await vouchSpot(parking, status) } catch { /* The shared error is rendered below. */ } finally { setSending(false) }
  }
  const free = report?.status === 'AVAILABLE'
  return <section className="crowd-card" aria-label="Verifiko disponueshmerine">
    <header><span><small>Komuniteti</small><strong>{report ? (free ? 'Raportuar ende i lire' : 'Raportuar i zene') : 'A eshte ende i lire?'}</strong></span><b>{relativeVerifiedTime(report?.createdAt)}</b></header>
    <div className="crowd-card__actions">
      <button className={free ? 'selected' : ''} disabled={sending} onClick={() => void submit('free')} aria-pressed={free}>Ende i lire</button>
      <button className={report?.status === 'OCCUPIED' ? 'selected crowd-card__taken' : ''} disabled={sending} onClick={() => void submit('taken')} aria-pressed={report?.status === 'OCCUPIED'}>I zene</button>
    </div>
    {error && <small className="crowd-card__error" role="alert">{error}</small>}
  </section>
}

export function LeavingButton({ parking }: { parking: Parking }) {
  return <section className="crowd-card crowd-card--leaving" aria-label="Raporto nje vend te lire">
    <header><span><small>Ndihmo komunitetin</small><strong>Po largohesh?</strong></span><b>Raport live</b></header>
    <SpotVouching parking={parking} />
  </section>
}
