import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { handleOpenExternal } from './externalLinks'
import type { MapCoordinate } from './types'

const PARKED_LOCATION_KEY = 'parko-parked-location'
const SMS_DESTINATION = '55055'

type ParkedLocation = {
  coordinates: MapCoordinate
  savedAt: number
  endsAt: number
  note: string
  photo?: string
}

function readParkedLocation(): ParkedLocation | null {
  try {
    const value = JSON.parse(localStorage.getItem(PARKED_LOCATION_KEY) ?? 'null') as ParkedLocation | null
    return value?.coordinates && typeof value.endsAt === 'number' ? value : null
  } catch {
    return null
  }
}

function formatRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000))
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`
}

export function NavigationHandoffButton({ coordinates }: { coordinates: MapCoordinate }) {
  const destination = `${coordinates.lat},${coordinates.lng}`
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
  const wazeUrl = `https://www.waze.com/ul?ll=${encodeURIComponent(destination)}&navigate=yes`

  return (
    <div className="driver-tool-nav" aria-label="Navigim drejt vendit të parkuar">
      <button type="button" onClick={() => void handleOpenExternal(googleMapsUrl)}>↗ Google Maps</button>
      <button type="button" onClick={() => void handleOpenExternal(wazeUrl)}>↗ Waze</button>
    </div>
  )
}

export function SaveMyParkedLocationCard({ initialLocation }: { initialLocation?: MapCoordinate }) {
  const [location, setLocation] = useState<ParkedLocation | null>(() => readParkedLocation())
  const [coordinates, setCoordinates] = useState<MapCoordinate | undefined>(location?.coordinates ?? initialLocation)
  const [note, setNote] = useState(location?.note ?? '')
  const [duration, setDuration] = useState<1 | 2>(location && location.endsAt - location.savedAt > 90 * 60_000 ? 2 : 1)
  const [photo, setPhoto] = useState(location?.photo)
  const [remaining, setRemaining] = useState(() => location ? location.endsAt - Date.now() : 0)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!location) return undefined
    const timer = window.setInterval(() => setRemaining(location.endsAt - Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [location])

  const timerLabel = useMemo(() => remaining > 0 ? formatRemaining(remaining) : 'Koha ka skaduar', [remaining])

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Lokacioni nuk mbështetet në këtë pajisje.')
      return
    }
    setStatus('Duke gjetur lokacionin…')
    navigator.geolocation.getCurrentPosition(
      ({ coords: current }) => {
        setCoordinates({ lat: current.latitude, lng: current.longitude })
        setStatus('Lokacioni u gjet.')
      },
      () => setStatus('Nuk mundëm të marrim lokacionin. Kontrollo lejen e GPS-it.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  function save() {
    if (!coordinates) {
      setStatus('Së pari prek “Gjej lokacionin”.')
      return
    }
    const savedAt = Date.now()
    const next: ParkedLocation = { coordinates, savedAt, endsAt: savedAt + duration * 60 * 60_000, note: note.trim(), photo }
    localStorage.setItem(PARKED_LOCATION_KEY, JSON.stringify(next))
    setLocation(next)
    setRemaining(next.endsAt - Date.now())
    setStatus('Vendi u ruajt.')
  }

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }

  return (
    <section className="driver-tool-card parked-location-card" aria-label="Ruaj lokacionin e parkuar">
      <div className="driver-tool-card__heading"><span className="driver-tool-icon">⌖</span><div><small>Pas parkimit</small><h2>Ruaj vendin ku parkova</h2></div></div>
      <p className="driver-tool-copy">Ruaj pin-in, një foto dhe shënim që ta gjesh makinën pa kërkuar.</p>
      <button type="button" className="driver-tool-primary" onClick={locate}>⌖ {coordinates ? 'Përditëso lokacionin' : 'Gjej lokacionin tim'}</button>
      {coordinates && <p className="driver-tool-coordinate">{coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}</p>}
      <div className="driver-tool-grid">
        <label>Koha e pagesës<select value={duration} onChange={(event) => setDuration(Number(event.target.value) as 1 | 2)}><option value="1">1 orë</option><option value="2">2 orë</option></select></label>
        <label>Shënim<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="p.sh. Hyrja B" /></label>
      </div>
      <label className="driver-tool-photo">📷 <span>{photo ? 'Ndrysho foton' : 'Shto foto reference'}</span><input type="file" accept="image/*" capture="environment" onChange={onPhoto} /></label>
      {photo && <img className="parked-location-photo" src={photo} alt="Referencë e vendit të parkuar" />}
      <button type="button" className="driver-tool-primary" onClick={save}>Ruaj vendin dhe nis kohëmatësin</button>
      {location && <div className="parked-location-result"><strong>⏱ {timerLabel}</strong>{location.note && <span>{location.note}</span>}<NavigationHandoffButton coordinates={location.coordinates} /></div>}
      {status && <p className="driver-tool-status" role="status">{status}</p>}
    </section>
  )
}

export function SmsTariffHelper({ defaultZone = '1' }: { defaultZone?: string }) {
  const [zone, setZone] = useState(defaultZone)
  const [plate, setPlate] = useState('')
  const smsText = `${zone.trim() || '1'} ${plate.trim() || 'TARGA_E_AUTOMJETIT'}`
  const href = `sms:${SMS_DESTINATION}?body=${encodeURIComponent(smsText)}`

  return (
    <section className="driver-tool-card sms-helper-card" aria-label="Ndihmës për SMS të tarifës">
      <div className="driver-tool-card__heading"><span className="driver-tool-icon">✉</span><div><small>Prishtina Parking</small><h2>Paguaj me SMS</h2></div></div>
      <p className="driver-tool-copy">Plotëso zonën dhe targën. Mesazhi hapet gati në aplikacionin SMS.</p>
      <div className="driver-tool-grid driver-tool-grid--sms">
        <label>Zona<select value={zone} onChange={(event) => setZone(event.target.value)}><option value="1">Zona 1</option><option value="2">Zona 2</option></select></label>
        <label>Targa<input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} placeholder="p.sh. 01-123-AB" /></label>
      </div>
      <code className="sms-preview">{smsText}</code>
      <a className="driver-tool-primary driver-tool-link" href={href} onClick={(event) => { event.preventDefault(); window.location.href = href }}>Hap SMS-in për {SMS_DESTINATION}</a>
      <small className="driver-tool-footnote">Kontrollo numrin e zonës në tabelën pranë parkingut para dërgimit.</small>
    </section>
  )
}
