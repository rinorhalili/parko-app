import { useEffect, useMemo, useRef, useState } from 'react'
import { getParking, listParking, nearbyParking } from './api/parkingService'
import { createReservation, type Reservation } from './api/reservationService'
import type { NearbyParkingSpot, ParkingSpot, ParkingStatus, ParkingType } from './api/types'
import { useSocket } from './hooks/useSocket'
import type { MapCoordinate } from './types'

type Spot = ParkingSpot | NearbyParkingSpot
type Duration = 30 | 60 | 120 | 240

const statusLabels: Record<ParkingStatus, string> = {
  AVAILABLE: 'I lirë', OCCUPIED: 'I zënë', RESERVED: 'I rezervuar', TEMPORARILY_UNAVAILABLE: 'Përkohësisht i padisponueshëm', UNKNOWN: 'Gjendje e panjohur'
}
const typeLabels: Record<ParkingType, string> = {
  STREET: 'Në rrugë', GARAGE: 'Garazh', LOT: 'Parkim i hapur', PRIVATE: 'Privat', ACCESSIBLE: 'Qasje e lehtë'
}

function reservable(spot: Spot | null): spot is ParkingSpot {
  return Boolean(spot && 'verifiedAt' in spot && spot.verifiedAt && ['PRIVATE', 'GARAGE', 'LOT'].includes(spot.type) && spot.status !== 'TEMPORARILY_UNAVAILABLE')
}

function formatWindow(startsAt: Date, expiresAt: Date) {
  return new Intl.DateTimeFormat('sq-AL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(startsAt) + ' – ' + new Intl.DateTimeFormat('sq-AL', { hour: '2-digit', minute: '2-digit' }).format(expiresAt)
}

export default function CommunitySpots({ userLocation, canReserve, onBack, onLogin }: { userLocation?: MapCoordinate; canReserve: boolean; onBack: () => void; onLogin: () => void }) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [selected, setSelected] = useState<Spot | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState<Duration>(60)
  const [submitting, setSubmitting] = useState(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const dragStart = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const request = userLocation ? nearbyParking({ lat: userLocation.lat, lng: userLocation.lng }) : listParking()
    void request.then((items) => { if (!cancelled) setSpots(items) }).catch(() => { if (!cancelled) setError('Parkingjet nuk mund të ngarkohen. Provo përsëri.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userLocation?.lat, userLocation?.lng])

  useSocket({
    onParkingUpdate: (event) => {
      setSpots((current) => current.map((spot) => spot.id === event.parkingSpotId ? { ...spot, status: event.status } : spot))
      setSelected((current) => current?.id === event.parkingSpotId ? { ...current, status: event.status } : current)
    }
  })

  const title = userLocation ? 'Parkingje pranë teje' : 'Parkingje nga komuniteti'
  const selectedWindow = useMemo(() => {
    const startsAt = new Date()
    return { startsAt, expiresAt: new Date(startsAt.getTime() + duration * 60_000) }
  }, [duration])

  async function openSpot(spot: Spot) {
    setSelected(spot)
    setReservation(null)
    setDetailLoading(true)
    try {
      const detail = await getParking(spot.id)
      setSelected(detail)
    } catch {
      // The list information is still useful when the spot has just changed.
    } finally {
      setDetailLoading(false)
    }
  }

  async function submitReservation() {
    if (!reservable(selected) || submitting) return
    const { startsAt, expiresAt } = selectedWindow
    if (startsAt.getTime() < Date.now() - 5 * 60_000 || expiresAt.getTime() - startsAt.getTime() < 15 * 60_000) {
      setError('Zgjidh një kohëzgjatje të vlefshme.'); return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createReservation({ parkingSpotId: selected.id, startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString() })
      setReservation(created)
      setSpots((current) => current.map((spot) => spot.id === selected.id ? { ...spot, status: 'RESERVED' } : spot))
      setSelected({ ...selected, status: 'RESERVED' })
    } catch {
      setError('Rezervimi nuk u krijua. Provo përsëri.')
    } finally {
      setSubmitting(false)
    }
  }

  function dragStartHandler(event: React.PointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function dragMoveHandler(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null || !sheetRef.current) return
    sheetRef.current.style.setProperty('--sheet-drag-y', `${Math.max(0, event.clientY - dragStart.current)}px`)
  }
  function dragEndHandler(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    dragStart.current = null
    if (sheetRef.current) sheetRef.current.style.setProperty('--sheet-drag-y', '0px')
    if (start !== null && event.clientY - start > 90) setSelected(null)
  }

  return <div className="screen community-spots-screen">
    <header className="saved-header"><button className="floating-back community-spots-back" onClick={onBack} aria-label="Kthehu">‹</button><div><small>Parko</small><h1>{title}</h1><p>{userLocation ? 'Vende të regjistruara afër lokacionit tënd.' : 'Aktivizo lokacionin për renditje sipas afërsisë.'}</p></div></header>
    <main className="community-spots-list">
      {loading && <p className="app-loading" role="status">Duke ngarkuar parkingjet…</p>}
      {!loading && error && <div className="empty-state"><strong>{error}</strong><button onClick={() => window.location.reload()}>Provo përsëri</button></div>}
      {!loading && !error && !spots.length && <div className="empty-state"><strong>Nuk ka parkingje të regjistruara.</strong><span>Provo përsëri më vonë.</span></div>}
      {spots.map((spot) => <button className="community-spot-card" key={spot.id} onClick={() => void openSpot(spot)}><span><strong>{spot.title}</strong><small>{spot.address ?? spot.zone ?? 'Adresa nuk dihet'}</small></span><i className={`community-status community-status--${spot.status.toLowerCase()}`}>{statusLabels[spot.status]}</i><em>{typeLabels[spot.type]}</em></button>)}
    </main>
    {selected && <section ref={sheetRef} className="parking-preview-sheet community-spot-sheet" aria-label={`Detajet për ${selected.title}`}>
      <div className="parking-preview-sheet__handle" onPointerDown={dragStartHandler} onPointerMove={dragMoveHandler} onPointerUp={dragEndHandler} />
      <header><span><small>{typeLabels[selected.type]}</small><strong>{selected.title}</strong></span><button onClick={() => setSelected(null)} aria-label="Mbyll">×</button></header>
      <p className="community-spot-address">{selected.address ?? selected.zone ?? 'Adresa nuk dihet'}</p>
      <i className={`community-status community-status--${selected.status.toLowerCase()}`}>{statusLabels[selected.status]}</i>
      {detailLoading && <p role="status">Duke hapur detajet…</p>}
      {reservation ? <div className="reservation-confirmation"><strong>Rezervimi u konfirmua</strong><span>{formatWindow(new Date(reservation.startsAt), new Date(reservation.expiresAt))}</span><button onClick={() => setSelected(null)}>Në rregull</button></div> : reservable(selected) && canReserve ? <div className="reservation-form"><strong>Rezervo vendin</strong><div className="reservation-durations">{([30, 60, 120, 240] as Duration[]).map((value) => <button key={value} className={duration === value ? 'selected' : ''} onClick={() => setDuration(value)}>{value < 60 ? '30 min' : `${value / 60} orë`}</button>)}</div><small>{formatWindow(selectedWindow.startsAt, selectedWindow.expiresAt)}</small><button className="button reservation-submit" disabled={submitting} onClick={() => void submitReservation()}>{submitting ? 'Duke rezervuar…' : 'Rezervo'}</button></div> : <p className="community-spot-note">{reservable(selected) ? 'Hyr në llogari për të rezervuar këtë vend.' : 'Ky vend nuk është i disponueshëm për rezervim.'}</p>}
      {!canReserve && reservable(selected) && <button className="community-login-link" onClick={onLogin}>Hyr në llogari për të rezervuar</button>}
      {error && <p className="community-form-error" role="alert">{error}</p>}
    </section>}
  </div>
}
