import { useEffect, useMemo, useRef, useState } from 'react'
import LiveParkingMap from './LiveParkingMap'
import { parkingAccessPoint } from './parkingGeometry'
import { reliableArrival, remainingTrip } from './navigationProgress'
import type { DrivingRoute, MapSettings, Parking } from './types'
import './navigation.css'
import { AppIcon } from './ui/Icon'
import { TripSummary } from './ui/components'

export default function NavigationView({ parking, route, routeLoading, routeError, userLocation, userLocationLive, userLocationAccuracy, locationTimestamp, mapSettings, recenterToken, hasDestination, onRecenter, onStop, onArrive }: {
  parking: Parking
  route: DrivingRoute | null
  routeLoading: boolean
  routeError: string
  userLocation: Parking['coordinates']
  userLocationLive: boolean
  userLocationAccuracy: number | null
  locationTimestamp: number | null
  mapSettings: MapSettings
  recenterToken: number
  hasDestination: boolean
  onRecenter: () => void
  onStop: () => void
  onArrive: () => void
}) {
  const [now, setNow] = useState(Date.now)
  const [arrivedAt, setArrivedAt] = useState<number | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [lastRoute, setLastRoute] = useState(route)
  const arrivalFix = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const displayRoute = route ?? lastRoute
  const arrived = arrivedAt !== null
  const freshLocation = userLocationLive && locationTimestamp !== null && now - locationTimestamp <= 30_000
  const target = parkingAccessPoint(parking, userLocation)
  const progress = useMemo(() => displayRoute ? remainingTrip(displayRoute, userLocation) : null, [displayRoute, userLocation])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    closeRef.current?.focus({ preventScroll: true })
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { if (route) setLastRoute(route) }, [route])
  useEffect(() => {
    if (arrived) return
    if (!userLocationLive || !reliableArrival(userLocation, target, userLocationAccuracy, locationTimestamp, now)) {
      arrivalFix.current = null
      return
    }
    // Require two distinct fixes at least three seconds apart; a timer or a
    // single noisy location must never finish a journey.
    if (arrivalFix.current === null) arrivalFix.current = locationTimestamp
    else if (locationTimestamp! - arrivalFix.current >= 3000) setArrivedAt(now)
  }, [arrived, userLocationLive, userLocation, target.lat, target.lng, userLocationAccuracy, locationTimestamp, now])

  const minutes = arrived ? '0' : progress && freshLocation ? String(Math.max(1, Math.ceil(progress.durationSeconds / 60))) : '—'
  const eta = arrivedAt ?? (progress && freshLocation ? now + progress.durationSeconds * 1000 : null)
  const etaLabel = eta === null ? '—' : new Intl.DateTimeFormat('sq-AL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(eta)
  const distance = arrived ? 0 : progress?.distanceMeters
  const distanceLabel = distance === undefined ? '—' : distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance / 10) * 10} m`
  const nextStep = route?.steps.find(step => !['depart', 'arrive'].includes(step.maneuverType)) ?? route?.steps[0]
  const status = arrived ? 'Ke mbërritur në parking.' : !freshLocation ? 'Duke pritur sinjalin GPS · udhëzimet janë pezulluar.' : routeError ? 'Lidhja me rrugën u ndërpre · po shfaqet vlerësimi i fundit.' : routeLoading || progress?.offRoute ? 'Duke përditësuar rrugën…' : 'Përditësohet me lokacionin · koha është e përafërt.'

  return <div className={`screen screen--map navigation-screen${arrived ? ' navigation-screen--arrived' : ''}`}>
    <LiveParkingMap parkings={[]} selected={parking} onSelect={() => undefined} mode="navigation" route={displayRoute}
      recenterToken={recenterToken} userLocation={userLocation} userLocationLive={freshLocation}
      userLocationAccuracy={userLocationAccuracy} mapSettings={mapSettings} />

    <header className="trip-header">
      <div className="trip-maneuver">
        <span className="trip-maneuver__icon" aria-hidden="true">{arrived ? '✓' : nextStep?.instruction.includes('majtas') ? '↰' : nextStep?.instruction.includes('djathtas') ? '↱' : '↑'}</span>
        <div>
          <span className="trip-eyebrow">{arrived ? 'Në destinacion' : 'Drejt parkingut'}</span>
          <h1>{arrived ? 'Ke mbërritur' : !freshLocation ? 'Duke pritur lokacionin' : !route || progress?.offRoute ? 'Duke kërkuar udhëzimet' : nextStep?.instruction ?? 'Vazhdo drejt parkingut'}</h1>
          {!arrived && freshLocation && route && !progress?.offRoute && <p>{nextStep?.roadName}{nextStep && nextStep.distanceMeters > 0 && <span> · segmenti {nextStep.distanceMeters >= 1000 ? `${(nextStep.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(nextStep.distanceMeters)} m`}</span>}</p>}
        </div>
      </div>
      <button ref={closeRef} className="trip-close" onClick={onStop} aria-label="Mbyll navigimin" title="Mbyll navigimin">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>

    <section className="trip-panel" aria-label="Udhëtimi drejt parkingut">
      <div className="trip-destination-row">
        <span className="trip-parking-icon" aria-hidden="true">{arrived ? '✓' : 'P'}</span>
        <div className="trip-destination"><h2>{parking.name}</h2><p>{parking.address || parking.zone}</p></div>
      </div>
      <TripSummary minutes={minutes} eta={etaLabel} distance={distanceLabel} arrived={arrived} />
      <div className="trip-status" role="status">{status}</div>
      {!arrived && <>
        <div className="trip-actions">
          <button onClick={onRecenter} aria-label="Rikthe hartën te lokacioni im"><AppIcon name="recenter" size={18} /><span>Lokacioni im</span></button>
          <button onClick={() => setShowSteps(value => !value)} aria-expanded={showSteps} aria-controls="trip-steps"><AppIcon name="route" size={18} />{showSteps ? 'Mbyll hapat' : 'Hapat e rrugës'}</button>
        </div>
        {showSteps && <ol id="trip-steps" className="trip-steps">{(route?.steps ?? []).map((step, index) => <li key={index}><strong>{step.instruction}</strong><span>{step.roadName} · {step.distanceMeters} m</span></li>)}{!route && <li>Udhëzimet nuk janë të disponueshme.</li>}</ol>}
      </>}
      <button className={arrived ? 'trip-finish' : 'trip-arrive'} onClick={() => arrived ? onArrive() : setArrivedAt(Date.now())}>
        {arrived ? hasDestination ? 'Parkova · vazhdo në këmbë' : 'Përfundo navigimin' : 'Kam mbërritur'}
      </button>
    </section>
  </div>
}
