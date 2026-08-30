import { useEffect, useMemo, useRef, useState } from 'react'
import { loadVerifiedAvailability, mergeVerifiedAvailability } from './availabilityApi'
import { defaultParking } from './data'
import LiveParkingMap, { DEFAULT_MAP_SETTINGS } from './LiveParkingMap'
import { reverseGeocodeLocation, searchDestinationOnline, searchLocalDestinations } from './geocodingApi'
import { distanceMeters, rankParkings, walkableParkingCandidates } from './parkingRanking'
import { getPrishtinaParkingSnapshot, isWithinPrishtinaMap, loadParkingGeometry, loadPrishtinaParkings, USER_LOCATION } from './parkingApi'
import { parkingAccessPoint } from './parkingGeometry'
import { PRISHTINA_PARKING_RULES_URL } from './prishtinaParkingRules'
import { loadPreferences, savePreferences } from './persistence'
import { loadDrivingMatrix, loadDrivingRoute, loadWalkingRoute } from './routingApi'
import { googleStreetViewUrl, walkingDirectionsUrl } from './streetView'
import { handleOpenExternal } from './externalLinks'
import { captureEvent } from './telemetry'
import { AlertBanner, LeavingButton, SpotVouching } from './crowdsourcing'
import { SaveMyParkedLocationCard, SmsTariffHelper } from './DriverTools'
import type { DrivingMatrixEntry } from './routingApi'
import type { Destination, DrivingRoute, Filters, MapSettings, MapVariant, Parking, ParkingLoadStatus, ParkingPalette, ParkingPreference, RankedParking, Screen } from './types'

const initialFilters: Filters = {
  availableOnly: false,
  verifiedOnly: false,
  maxPrice: 2,
  type: 'all',
  freeOnly: false,
  paidOnly: false,
  evCharging: false,
  accessible: false,
}

function normalizedMapSettings(value?: Partial<MapSettings>): MapSettings {
  const variant = value?.variant && ['standard', 'minimal'].includes(value.variant) ? value.variant : DEFAULT_MAP_SETTINGS.variant
  const parkingPalette = value?.parkingPalette && ['green', 'price', 'operator'].includes(value.parkingPalette) ? value.parkingPalette : DEFAULT_MAP_SETTINGS.parkingPalette
  return { ...DEFAULT_MAP_SETTINGS, ...value, variant, parkingPalette }
}

const RECENT_DESTINATIONS_KEY = 'parko-recent-destinations'
const PARKING_REPORTS_KEY = 'parko-live-parking-reports'
type LocationStatus = 'idle' | 'locating' | 'ready' | 'outside' | 'denied' | 'unavailable'

type ParkingReport = {
  parkingId: string
  availability?: 'free-spots' | 'full'
  payment?: 'free' | 'paid'
  policeRisk?: boolean
  updatedAt: number
}

type ParkingReportPatch = Omit<Partial<ParkingReport>, 'parkingId' | 'updatedAt'>

function loadParkingReports() {
  try {
    const value = JSON.parse(localStorage.getItem(PARKING_REPORTS_KEY) ?? '{}') as Record<string, ParkingReport>
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function saveParkingReports(reports: Record<string, ParkingReport>) {
  try { localStorage.setItem(PARKING_REPORTS_KEY, JSON.stringify(reports)) } catch { /* storage can be unavailable */ }
}

function reportAgeLabel(report?: ParkingReport) {
  if (!report) return ''
  const minutes = Math.max(0, Math.round((Date.now() - report.updatedAt) / 60_000))
  if (minutes < 1) return 'tani'
  return `${minutes} min me pare`
}

function reportMessage(parking: Parking, report?: ParkingReport) {
  if (report?.availability === 'free-spots' || (parking.spaces !== null && parking.spaces > 0)) {
    const spaces = parking.spaces !== null && parking.spaces > 0 ? `${parking.spaces} vende te lira` : 'ka vende te lira'
    return `Raportim live: ${spaces}${report ? ` • ${reportAgeLabel(report)}` : ''}`
  }
  if (report?.availability === 'full' || parking.status === 'full') return `Raportim live: parkingu duket plot${report ? ` • ${reportAgeLabel(report)}` : ''}`
  return 'Ska raportime per parking te lire ne kete zone'
}

function policeRiskLabel(report?: ParkingReport) {
  if (!report || report.policeRisk === undefined) return 'Siguria: pa raport'
  return report.policeRisk ? 'Siguria: polici afër' : 'Siguria: duket qetë'
}
function applyParkingReport(parking: Parking, report?: ParkingReport): Parking {
  if (!report) return parking
  const ageMinutes = Math.max(0, Math.round((Date.now() - report.updatedAt) / 60_000))
  const paymentUpdate = report.payment === 'free'
    ? { pricePerHour: 0, free: true }
    : report.payment === 'paid' && parking.pricePerHour === 0
      ? { pricePerHour: null, free: false }
      : report.payment === 'paid'
        ? { free: false }
        : {}
  const availabilityUpdate = report.availability === 'free-spots'
    ? { spaces: parking.spaces && parking.spaces > 0 ? parking.spaces : 1, status: 'available' as const, availabilitySource: 'Raport perdoruesi', updatedMinutesAgo: ageMinutes, availabilityUpdatedAt: new Date(report.updatedAt).toISOString() }
    : report.availability === 'full'
      ? { spaces: 0, status: 'full' as const, availabilitySource: 'Raport perdoruesi', updatedMinutesAgo: ageMinutes, availabilityUpdatedAt: new Date(report.updatedAt).toISOString() }
      : {}
  return { ...parking, ...paymentUpdate, ...availabilityUpdate }
}
function loadRecentDestinations(): Destination[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_DESTINATIONS_KEY) ?? '[]') as Destination[]
    return Array.isArray(value) ? value.slice(0, 5) : []
  } catch {
    return []
  }
}

function StatusBar({ light = false }: { light?: boolean }) {
  const time = new Intl.DateTimeFormat('sq-AL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  return (
    <div className={`status-bar ${light ? 'status-bar--light' : ''}`} aria-hidden="true">
      <span>{time}</span>
      <span className="status-icons">▮▮▮ ⌁ ▰</span>
    </div>
  )
}

function IosInstallPrompt() {
  const [visible, setVisible] = useState(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    return isIos && !standalone && localStorage.getItem('parko-ios-install-dismissed') !== '1'
  })
  if (!visible) return null
  return <aside className="ios-install-prompt" role="status">
    <span className="ios-install-prompt__icon">↑</span>
    <p><b>Instalo Parko në iPhone</b><small>Në Safari prek Share, pastaj “Add to Home Screen”.</small></p>
    <button onClick={() => { localStorage.setItem('parko-ios-install-dismissed', '1'); setVisible(false) }} aria-label="Mbyll udhëzimin e instalimit">×</button>
  </aside>
}

function priceLabel(parking: Parking) {
  if (parking.pricePerHour === null) return 'Pa çmim'
  return parking.pricePerHour === 0 ? 'Falas' : `${parking.pricePerHour.toFixed(2)} €/orë`
}

function accessLabel(parking: Parking) {
  return {
    public: 'Qasje publike',
    permissive: 'Qasje e lejuar',
    customers: 'Vetëm për klientë',
    private: 'Privat',
    permit: 'Vetëm me leje',
    no: 'Pa qasje publike',
    unknown: 'Qasja nuk është konfirmuar',
  }[parking.access]
}

function availabilityLabel(parking: Parking) {
  if (parking.spaces !== null) return `${parking.spaces} vende të lira${parking.updatedMinutesAgo ? ` • ${parking.updatedMinutesAgo} min më parë` : ' • tani'}`
  if (parking.capacity !== null) return `Kapacitet ${parking.capacity} • vendet e lira nuk dihen`
  return 'Disponueshmëria nuk raportohet live'
}

function parkingTrust(parking: Parking) {
  if (parking.availabilitySource) return {
    tone: 'live',
    label: `Live · ${parking.availabilitySource}`,
    detail: parking.updatedMinutesAgo ? `Përditësuar ${parking.updatedMinutesAgo} min më parë` : 'Përditësuar tani',
  }
  if (parking.municipalManaged) return {
    tone: 'official',
    label: 'Operator i identifikuar',
    detail: 'Operatori është i identifikuar; shfaqen vetëm të dhënat e konfirmuara.',
  }
  if (parking.confidence === 'high') return {
    tone: 'mapped',
    label: 'OSM · e dokumentuar',
    detail: 'Lokacioni dhe konturi janë të hartuar; disponueshmëria nuk është live.',
  }
  if (parking.confidence === 'medium') return {
    tone: 'partial',
    label: 'OSM · e pjesshme',
    detail: 'Disa të dhëna mungojnë; kontrollo tabelën dhe hyrjen.',
  }
  return {
    tone: 'unknown',
    label: 'E pakonfirmuar',
    detail: 'Vetëm lokacioni bazë është i hartuar.',
  }
}

function DataTrustBadge({ parking, detailed = false }: { parking: Parking; detailed?: boolean }) {
  const trust = parkingTrust(parking)
  return (
    <span className={`data-trust data-trust--${trust.tone} ${detailed ? 'data-trust--detailed' : ''}`}>
      <i />
      <span><b>{trust.label}</b>{detailed && <small>{trust.detail}</small>}</span>
    </span>
  )
}

function municipalCategoryLabel(parking: Parking) {
  if (!parking.municipalCategory) return null
  return {
    residential: 'Rezidencial',
    commercial: 'Komercial',
    combined: 'I kombinuar',
    barrier: 'Me rampë',
  }[parking.municipalCategory]
}

function parkingTypeLabel(parking: Parking) {
  if (parking.municipalManaged) return 'Prishtina Parking'
  return {
    public: 'Publik · OSM',
    private: 'Privat',
    street: 'Në rrugë',
  }[parking.type]
}

function BottomNav({ active = 'home', onHome, onSaved, onSettings }: { active?: 'home' | 'saved' | 'settings'; onHome?: () => void; onSaved: () => void; onSettings: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navigimi kryesor">
      <button className={`bottom-nav__item ${active === 'home' ? 'bottom-nav__item--active' : ''}`} onClick={onHome} aria-current={active === 'home' ? 'page' : undefined}><span>➤</span>Harta</button>
      <button className={`bottom-nav__item ${active === 'saved' ? 'bottom-nav__item--active' : ''}`} onClick={onSaved} aria-current={active === 'saved' ? 'page' : undefined}><span>♡</span>Ruajtur</button>
      <button className={`bottom-nav__item ${active === 'settings' ? 'bottom-nav__item--active' : ''}`} onClick={onSettings} aria-current={active === 'settings' ? 'page' : undefined}><span>⚙</span>Cilësimet</button>
    </nav>
  )
}

function verifiedPriceLabel(parking: Parking) {
  return parking.pricingSource ? priceLabel(parking) : null
}

function parkingSourceLabel(parking: Parking) {
  if (parking.municipalManaged) return 'Prishtina Parking'
  if (parking.source === 'openstreetmap' && parking.confidence !== 'low') return 'OpenStreetMap'
  return 'Burim i pakonfirmuar'
}

function ParkingCard({ parking, smartMatch, showSource = true, onOpen }: { parking: Parking; smartMatch?: RankedParking; showSource?: boolean; onOpen: () => void }) {
  const verifiedPrice = verifiedPriceLabel(parking)
  const liveAvailability = parking.spaces !== null && parking.availabilitySource ? availabilityLabel(parking) : null
  const journey = smartMatch
    ? [`${smartMatch.walkMinutes} min ecje`, `${smartMatch.driveMinutes} min vozitje`]
    : [`${parking.driveMinutes} min vozitje`]
  return (
    <article
      className="parking-card"
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
      role="button"
      tabIndex={0}
      aria-label={`Hap detajet për ${parking.name}`}
    >
      <div className="parking-card__icon">{smartMatch?.rank ?? (parking.municipalManaged ? 'PP' : '•')}</div>
      <div className="parking-card__content">
        <strong>{parking.name}</strong>
        {liveAvailability && <span className={`availability-text availability-text--${parking.status}`}>{liveAvailability}</span>}
        <small>{[...journey, verifiedPrice].filter(Boolean).join(' • ')}</small>
        <span className="parking-card__badges">
          <span className={`parking-kind parking-kind--${parking.municipalManaged ? 'municipal' : parking.type}`}>{parkingTypeLabel(parking)}</span>
          {showSource && <DataTrustBadge parking={parking} />}
        </span>
      </div>
      <span className="parking-card__chevron" aria-hidden="true">›</span>
    </article>
  )
}

type ParkingTypeFilter = Extract<Filters['type'], 'all' | 'public' | 'private' | 'street' | 'municipal'>
type ParkingTypeCounts = Record<ParkingTypeFilter, number>
type ParkingFeatureCounts = {
  verified: number
  free: number
  paid: number
  ev: number
  accessible: number
  live: number
}

const parkingTypeOptions: Array<[ParkingTypeFilter, string, string]> = [
  ['all', 'Të gjitha', 'Çdo operator'],
  ['municipal', 'Prishtina Parking', 'Operatori zyrtar'],
  ['public', 'Publike', 'Burim OpenStreetMap'],
  ['street', 'Në rrugë', 'Parking anësor'],
  ['private', 'Private', 'Biznes ose klientë'],
]

function parkingMatchesType(parking: Parking, type: ParkingTypeFilter) {
  if (type === 'all') return true
  if (type === 'municipal') return Boolean(parking.municipalManaged)
  if (parking.municipalManaged) return false
  return parking.type === type
}

function accuracyLabel(accuracy: number | null) {
  if (!accuracy) return ''
  return ` · ±${Math.round(accuracy)} m`
}

function locationStatusLabel(status: LocationStatus, accuracy: number | null) {
  if (status === 'locating') return 'Duke gjetur GPS-in…'
  if (status === 'ready') return `GPS live${accuracyLabel(accuracy)}`
  if (status === 'outside') return 'GPS jashtë Prishtinës'
  if (status === 'denied') return 'Leja e GPS-it u refuzua'
  if (status === 'unavailable') return 'GPS nuk u gjet'
  return 'Përdor GPS-in'
}

function locationActionLabel(status: LocationStatus) {
  if (status === 'locating') return 'Duke gjetur lokacionin'
  if (status === 'ready') return 'Lokacioni live në Prishtinë'
  if (status === 'outside') return 'Lokacioni yt është jashtë Prishtinës'
  if (status === 'denied') return 'Leja e lokacionit është refuzuar'
  if (status === 'unavailable') return 'GPS nuk është i disponueshëm'
  return 'Përdor lokacionin tim'
}

function ParkingTypeChooser({ value, counts, onChange }: { value: ParkingTypeFilter; counts: ParkingTypeCounts; onChange: (type: ParkingTypeFilter) => void }) {
  return (
    <div className="parking-type-chooser" aria-label="Zgjedh llojin e parkingut">
      {parkingTypeOptions.map(([type, label, description]) => (
        <button
          key={type}
          className={value === type ? 'selected' : ''}
          aria-pressed={value === type}
          disabled={type !== 'all' && counts[type] === 0}
          onClick={() => onChange(type)}
        >
          <span><strong>{label}</strong><small>{description}</small></span>
          <b>{counts[type]}</b>
        </button>
      ))}
    </div>
  )
}

function ParkingReportPanel({ parking, report, compact = false, onReport }: { parking: Parking; report?: ParkingReport; compact?: boolean; onReport: (parkingId: string, patch: ParkingReportPatch) => void }) {
  const reportSource = report ? `Raportuar ${reportAgeLabel(report)}` : parking.availabilitySource ? parking.availabilitySource : 'Pa raport komuniteti'
  return (
    <section className={`parking-report-panel ${compact ? 'parking-report-panel--compact' : ''}`} aria-label="Raportimet live per zonen e zgjedhur">
      <header className="parking-report-panel__header">
        <span><small>Live</small><strong>Raporto shpejt</strong></span>
        <b title={parking.name}>{parking.name}</b>
      </header>
      <div className="parking-report-panel__status">
        <strong>{reportMessage(parking, report)}</strong>
        <span>{reportSource} • {policeRiskLabel(report)}</span>
      </div>
      <div className="quick-report-groups" aria-label="Raporto parkingun">
        <div className="quick-report-group">
          <p>Vendet</p>
          <div className="quick-report-grid">
            <button className={report?.availability === 'free-spots' ? 'selected' : ''} onClick={() => onReport(parking.id, { availability: 'free-spots' })} aria-pressed={report?.availability === 'free-spots'}><span>+</span>Ka vende</button>
            <button className={report?.availability === 'full' ? 'selected' : ''} onClick={() => onReport(parking.id, { availability: 'full' })} aria-pressed={report?.availability === 'full'}><span>0</span>S'ka vende</button>
          </div>
        </div>
        <div className="quick-report-group">
          <p>Pagesa</p>
          <div className="quick-report-grid">
            <button className={(report?.payment === 'free' || parking.free) ? 'selected' : ''} onClick={() => onReport(parking.id, { payment: 'free' })} aria-pressed={report?.payment === 'free'}><span>€0</span>Falas</button>
            <button className={report?.payment === 'paid' ? 'selected' : ''} onClick={() => onReport(parking.id, { payment: 'paid' })} aria-pressed={report?.payment === 'paid'}><span>€</span>Me pagesë</button>
          </div>
        </div>
        <div className="quick-report-group">
          <p>Siguria</p>
          <div className="quick-report-grid">
            <button className={report?.policeRisk === true ? 'selected danger' : ''} onClick={() => onReport(parking.id, { policeRisk: true })} aria-pressed={report?.policeRisk === true}><span>!</span>Polici afër</button>
            <button className={report?.policeRisk === false ? 'selected safe' : ''} onClick={() => onReport(parking.id, { policeRisk: false })} aria-pressed={report?.policeRisk === false}><span>✓</span>Qetë</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function matchesFilters(parking: Parking, filters: Filters) {
  const matchesAvailability = !filters.availableOnly || parking.status === 'available' || parking.status === 'limited'
  const matchesVerified = !filters.verifiedOnly || parking.confidence !== 'low'
  const matchesPrice = filters.maxPrice >= 2 || (parking.pricePerHour !== null && parking.pricePerHour <= filters.maxPrice)
  const matchesType = parkingMatchesType(parking, filters.type as ParkingTypeFilter)
  const matchesFree = !filters.freeOnly || (parking.free && Boolean(parking.pricingSource))
  const matchesPaid = !filters.paidOnly || (parking.pricePerHour !== null && parking.pricePerHour > 0 && Boolean(parking.pricingSource))
  return matchesAvailability && matchesVerified && matchesPrice && matchesType && matchesFree && matchesPaid && (!filters.evCharging || parking.evCharging) && (!filters.accessible || parking.accessible)
}

function filtersForAvailability(filters: Filters, hasLiveAvailability: boolean): Filters {
  return hasLiveAvailability ? filters : { ...filters, availableOnly: false }
}

function HomeView({
  mapParkings,
  selected,
  filters,
  hasLiveAvailability,
  query,
  onQuery,
  searchResults,
  recentDestinations,
  searchOpen,
  searchingOnline,
  searchError,
  online,
  destination,
  walkingMinutes,
  preference,
  route,
  rankedParkings,
  showAllResults,
  pickingDestination,
  parkingPreviewOpen,
  typeCounts,
  featureCounts,
  onSelect,
  onSelectDestination,
  onClearRecent,
  onSearchFocus,
  onSearchOnline,
  onCloseSearch,
  onClearDestination,
  onWalkingMinutes,
  onPreference,
  onParkingType,
  onFiltersChange,
  onToggleShowAll,
  onStartMapPick,
  onPickDestination,
  recenterToken,
  onRecenter,
  locationStatus,
  locationAccuracy,
  userLocation,
  onDetails,
  onNavigate,
  streetViewHref,
  onCloseParkingPreview,
  onSaved,
  onSettings,
  mapSettings,
  loadStatus,
}: {
  mapParkings: Parking[]
  selected: Parking
  filters: Filters
  hasLiveAvailability: boolean
  query: string
  onQuery: (value: string) => void
  searchResults: Destination[]
  recentDestinations: Destination[]
  searchOpen: boolean
  searchingOnline: boolean
  searchError: string
  online: boolean
  destination: Destination | null
  walkingMinutes: 5 | 10 | 15
  preference: ParkingPreference
  route: DrivingRoute | null
  rankedParkings: RankedParking[]
  showAllResults: boolean
  pickingDestination: boolean
  parkingPreviewOpen: boolean
  typeCounts: ParkingTypeCounts
  featureCounts: ParkingFeatureCounts
  onSelect: (parking: Parking) => void
  onSelectDestination: (destination: Destination) => void
  onClearRecent: () => void
  onSearchFocus: () => void
  onSearchOnline: () => void
  onCloseSearch: () => void
  onClearDestination: () => void
  onWalkingMinutes: (minutes: 5 | 10 | 15) => void
  onPreference: (preference: ParkingPreference) => void
  onParkingType: (type: ParkingTypeFilter) => void
  onFiltersChange: (filters: Filters) => void
  onToggleShowAll: () => void
  onStartMapPick: () => void
  onPickDestination: (coordinates: { lat: number; lng: number }) => void
  recenterToken: number
  onRecenter: () => void
  locationStatus: LocationStatus
  locationAccuracy: number | null
  userLocation: Parking['coordinates']
  onDetails: () => void
  onNavigate: () => void
  streetViewHref: string
  onCloseParkingPreview: () => void
  onSaved: () => void
  onSettings: () => void
  mapSettings: MapSettings
  loadStatus: ParkingLoadStatus
}) {
  const [sheetState, setSheetState] = useState<'collapsed' | 'medium' | 'expanded'>('medium')
  const [plannerOpen, setPlannerOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement>(null)
  const selectedMatch = rankedParkings.find((match) => match.parking.id === selected.id)
  const categoryIcon = { building: '▦', street: '↔', area: '⌂', place: '●' }
  const categoryLabel = { building: 'Ndërtesë', street: 'Rrugë', area: 'Zonë', place: 'Vend' }
  const preferenceLabels: Array<[ParkingPreference, string]> = [
    ['best', 'Më e mira'],
    ['closest', 'Më afër'],
    ['cheapest', 'Më lirë'],
    ['chance', hasLiveAvailability ? 'Më shumë shanse' : 'Më e dokumentuar'],
  ]
  const recommendationRankMap = useMemo(
    () => new Map(rankedParkings.map((match) => [match.parking.id, match.rank])),
    [rankedParkings],
  )
  const localResults = searchResults.filter((result) => result.source === 'local')
  const remoteResults = searchResults.filter((result) => result.source === 'geocoder')
  const recentResults = query.trim() ? [] : recentDestinations
  const sheetMatches = destination ? (showAllResults ? rankedParkings : rankedParkings.slice(0, 3)) : []
  const sheetParkings = sheetMatches.map((match) => match.parking)
  const nextSheetState = sheetState === 'collapsed' ? 'medium' : sheetState === 'medium' ? 'expanded' : 'collapsed'
  const sheetToggleLabel = sheetState === 'collapsed'
    ? `${rankedParkings.length} parkingje • Hape`
    : sheetState === 'medium' ? 'Shfaq listën' : 'Mbylle listën'
  const selectedParkingType = filters.type as ParkingTypeFilter
  const visibleRoute = (destination && selectedMatch) || parkingPreviewOpen ? route : null
  const routeMinutes = route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : selected.driveMinutes
  const routeDistance = route?.distanceMeters ?? selected.distanceMeters
  const nextRoad = route?.steps.find((step) => step.roadName && step.roadName !== 'rruga pa emër')
  const activeFilterCount = [filters.type !== 'all', filters.verifiedOnly, filters.freeOnly, filters.paidOnly, filters.evCharging, filters.accessible, filters.availableOnly].filter(Boolean).length
  const locationLabel = locationStatusLabel(locationStatus, locationAccuracy)
  const locateIcon = locationStatus === 'locating' ? '…' : locationStatus === 'ready' ? '●' : locationStatus === 'outside' ? '!' : '➤'

  useEffect(() => {
    if (!searchOpen && !plannerOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (controlsRef.current?.contains(event.target as Node)) return
      onCloseSearch()
      setPlannerOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onCloseSearch()
      setPlannerOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [searchOpen, plannerOpen, onCloseSearch])

  useEffect(() => {
    if (destination) setSheetState('medium')
    setPlannerOpen(false)
  }, [destination?.id])

  useEffect(() => {
    if (pickingDestination) setSheetState('collapsed')
    else if (destination) setSheetState('medium')
  }, [pickingDestination, destination?.id])

  return (
    <div className={`screen screen--map ${destination ? `screen--smart screen--sheet-${sheetState}` : ''} ${parkingPreviewOpen && !destination ? 'screen--parking-preview' : ''} ${plannerOpen || searchOpen ? 'screen--top-panel-open' : ''}`}>
      <StatusBar />
      <LiveParkingMap
        parkings={mapParkings}
        selected={selected}
        onSelect={onSelect}
        mode="home"
        loadStatus={loadStatus}
        destination={destination}
        walkMinutes={walkingMinutes}
        recommendationRanks={recommendationRankMap}
        route={visibleRoute}
        pickingDestination={pickingDestination}
        onPickDestination={onPickDestination}
        recenterToken={recenterToken}
        userLocation={userLocation}
        userLocationLive={locationStatus === 'ready'}
        userLocationAccuracy={locationAccuracy}
        mapSettings={mapSettings}
      />
      <div className="home-controls" ref={controlsRef}>
        <div className="search-box">
          <span className="search-box__pin">⌕</span>
          <span className="search-box__copy">
            <input
              value={query}
              onFocus={() => { setPlannerOpen(false); onSearchFocus() }}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                const firstResult = localResults[0] ?? remoteResults[0]
                if (firstResult) onSelectDestination(firstResult)
                else onSearchOnline()
              }}
              placeholder="Kërko zonë, rrugë ose ndërtesë"
              aria-label="Kërko destinacion"
            />
          </span>
          {destination ? (
            <button type="button" className="round-button" onClick={onClearDestination} aria-label="Pastro destinacionin">×</button>
          ) : query ? (
            <button type="button" className="round-button" onClick={onClearDestination} aria-label="Pastro kërkimin">×</button>
          ) : (
            <button type="button" className="round-button" onClick={onSearchOnline} aria-label="Kërko destinacionin online">⌕</button>
          )}
        </div>

        {searchOpen && (
          <div className="search-suggestions" role="dialog" aria-label="Rezultatet e destinacionit">
            {recentResults.length > 0 && <div className="search-section-label"><span>Të fundit</span><button onClick={onClearRecent}>Pastro</button></div>}
            {recentResults.map((result) => (
              <button key={`recent-${result.id}`} onClick={() => onSelectDestination(result)}>
                <i>↻</i>
                <span><strong>{result.name}</strong><small>{categoryLabel[result.category]} · {result.subtitle}</small></span>
                <b>›</b>
              </button>
            ))}
            {localResults.length > 0 && <div className="search-section-label">Sugjerime në Prishtinë</div>}
            {localResults.map((result) => (
              <button key={result.id} onClick={() => onSelectDestination(result)}>
                <i>{categoryIcon[result.category]}</i>
                <span><strong>{result.name}</strong><small>{categoryLabel[result.category]} · {result.subtitle}</small></span>
                <b>›</b>
              </button>
            ))}
            {remoteResults.length > 0 && <div className="search-section-label">Rezultate online</div>}
            {remoteResults.map((result) => (
              <button key={result.id} onClick={() => onSelectDestination(result)}>
                <i>{categoryIcon[result.category]}</i>
                <span><strong>{result.name}</strong><small>{categoryLabel[result.category]} · {result.subtitle}</small></span>
                <b>›</b>
              </button>
            ))}
            {query.trim().length >= 2 && (
              <button className="online-search-row" onClick={onSearchOnline} disabled={searchingOnline}>
                <i>⌕</i>
                <span><strong>{searchingOnline ? 'Duke kërkuar…' : online ? `Kërko “${query}” online` : 'Kërkimi online nuk është i disponueshëm'}</strong><small>{online ? 'Rrugë, biznese dhe ndërtesa' : 'Kontrollo lidhjen me internet'}</small></span>
              </button>
            )}
            {searchError && <p className="search-message search-message--error" role="status">{searchError}</p>}
            <button className="map-pick-search-row" onClick={() => { setPlannerOpen(false); onStartMapPick() }}>
              <i>⌖</i>
              <span><strong>Zgjidh në hartë</strong><small>Vendose pin-in në lokacionin e saktë</small></span>
              <b>›</b>
            </button>
            {!recentResults.length && !searchResults.length && query.trim().length < 2 && <p className="search-message">Shkruaj të paktën dy shkronja.</p>}
          </div>
        )}

        <div className="map-action-row" aria-label="Veprimet e hartës">
          <button
            className={`map-action-button ${plannerOpen ? 'map-action-button--active' : ''}`}
            onClick={() => { onCloseSearch(); setPlannerOpen((value) => !value) }}
            aria-expanded={plannerOpen}
            aria-label={plannerOpen ? 'Mbyll filtrat' : 'Hap filtrat'}
          >
            <span>≡</span><b>Filtra</b>{activeFilterCount > 0 && <small>{activeFilterCount}</small>}
          </button>
          <button
            className={`map-action-button map-action-button--pick ${pickingDestination ? 'map-action-button--active' : ''}`}
            onClick={() => { setPlannerOpen(false); onCloseSearch(); onStartMapPick() }}
            aria-pressed={pickingDestination}
          >
            <span>⌖</span><b>{pickingDestination ? 'Anulo' : 'Zgjidh pikë'}</b>
          </button>
          <button
            className={`map-action-button map-action-button--location map-action-button--${locationStatus}`}
            onClick={() => { setPlannerOpen(false); onCloseSearch(); onRecenter() }}
            disabled={locationStatus === 'locating'}
            aria-label={locationActionLabel(locationStatus)}
          >
            <span>{locateIcon}</span><b>{locationStatus === 'locating' ? 'Duke gjetur' : locationStatus === 'ready' ? 'Lokacioni' : 'Ku jam'}</b>
          </button>
        </div>
        {locationStatus !== 'idle' && locationStatus !== 'ready' && <p className={`location-inline-status location-inline-status--${locationStatus}`} role="status">{locationLabel}</p>}

        {plannerOpen ? (
          <section className="smart-planner" aria-label="Filtrat e parkingjeve">
            <header>
              <span><small>Filtrat</small><strong>{destination ? `Parking për ${destination.name}` : 'Cilat parkingje dëshiron?'}</strong></span>
              <div className="planner-header-actions"><button onClick={() => setPlannerOpen(false)} aria-label="Mbyll filtrat">×</button></div>
            </header>
            {destination && (
              <div className="planner-options">
                <label><span>Ecje</span><select value={walkingMinutes} onChange={(event) => onWalkingMinutes(Number(event.target.value) as 5 | 10 | 15)} aria-label="Koha maksimale e ecjes"><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
                <label><span>Rendit</span><select value={preference} onChange={(event) => onPreference(event.target.value as ParkingPreference)} aria-label="Mënyra e renditjes">{preferenceLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
            )}
            <p className="filter-section-label">Lloji dhe operatori</p>
            <ParkingTypeChooser value={selectedParkingType} counts={typeCounts} onChange={onParkingType} />
            <p className="filter-section-label">Veçori</p>
            <div className="filter-chip-grid">
              <button disabled={featureCounts.verified === 0} className={filters.verifiedOnly ? 'selected' : ''} aria-pressed={filters.verifiedOnly} onClick={() => onFiltersChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}>✓ Të verifikuara <small>{featureCounts.verified}</small></button>
              <button disabled={featureCounts.free === 0} className={filters.freeOnly ? 'selected' : ''} aria-pressed={filters.freeOnly} onClick={() => onFiltersChange({ ...filters, freeOnly: !filters.freeOnly, paidOnly: false })}>€0 Falas <small>{featureCounts.free}</small></button>
              <button disabled={featureCounts.paid === 0} className={filters.paidOnly ? 'selected' : ''} aria-pressed={filters.paidOnly} onClick={() => onFiltersChange({ ...filters, paidOnly: !filters.paidOnly, freeOnly: false })}>€ Me pagesë <small>{featureCounts.paid}</small></button>
              <button disabled={featureCounts.ev === 0} className={filters.evCharging ? 'selected' : ''} aria-pressed={filters.evCharging} onClick={() => onFiltersChange({ ...filters, evCharging: !filters.evCharging })}>⚡ Karikim EV <small>{featureCounts.ev}</small></button>
              <button disabled={featureCounts.accessible === 0} className={filters.accessible ? 'selected' : ''} aria-pressed={filters.accessible} onClick={() => onFiltersChange({ ...filters, accessible: !filters.accessible })}>♿ Qasje e lehtë <small>{featureCounts.accessible}</small></button>
              <button disabled={!hasLiveAvailability} className={filters.availableOnly ? 'selected' : ''} aria-pressed={filters.availableOnly} onClick={() => onFiltersChange({ ...filters, availableOnly: !filters.availableOnly })}>● Ka vende live <small>{featureCounts.live}</small></button>
            </div>
            {activeFilterCount > 0 && <button className="clear-filters-button" onClick={() => onFiltersChange(initialFilters)}>Pastro të gjithë filtrat</button>}
          </section>
        ) : null}
      </div>

      {parkingPreviewOpen && !destination && (
        <section className="parking-preview-sheet" aria-label={`Parkingu i zgjedhur: ${selected.name}`}>
          <div className="parking-preview-sheet__handle" />
          <header>
            <span><small>{parkingTypeLabel(selected)}</small><strong>{selected.name}</strong></span>
            <button onClick={onCloseParkingPreview} aria-label="Mbyll parkingun e zgjedhur">×</button>
          </header>
          {mapSettings.showDataSources && <p className="parking-preview-source"><i />{parkingSourceLabel(selected)}</p>}
          <div className="parking-route-summary">
            <span><small>Me veturë</small><strong>{routeMinutes} min</strong></span>
            <span><small>Largësia</small><strong>{routeDistance >= 1000 ? `${(routeDistance / 1000).toFixed(1)} km` : `${routeDistance} m`}</strong></span>
            {verifiedPriceLabel(selected) && <span><small>Çmimi</small><strong>{verifiedPriceLabel(selected)}</strong></span>}
          </div>
          <p className="parking-route-road"><b>↗</b><span><small>Rruga e ardhshme</small><strong>{nextRoad?.roadName ?? selected.address}</strong></span></p>
          <div className="parking-preview-actions">
            <button className="button button--secondary" onClick={onDetails}>Detaje</button>
            <a className="button button--secondary" href={streetViewHref} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void handleOpenExternal(streetViewHref) }}>Street View</a>
            <button className="button" onClick={onNavigate}>Shko këtu</button>
          </div>
        </section>
      )}
      {destination && (
      <section className={`home-sheet home-sheet--smart home-sheet--${sheetState}`}>
        <button
          className="sheet-toggle"
          onClick={() => setSheetState(nextSheetState)}
          aria-expanded={sheetState !== 'collapsed'}
          aria-label={sheetState === 'collapsed' ? 'Hap parkingjet' : sheetState === 'medium' ? 'Zgjero listën e parkingjeve' : 'Mbyll listën e parkingjeve'}
        >
          <span className="drag-handle" />
          <span>{sheetToggleLabel}</span>
          <b>{sheetState === 'collapsed' ? '⌃' : sheetState === 'medium' ? '⌃' : '⌄'}</b>
        </button>
        <div className="home-sheet__content">
          <div className="sheet-heading">
            <h1>{`Parking për ${destination.name}`}</h1>
            <button onClick={onToggleShowAll}>{showAllResults ? 'Top 3' : `Të gjitha (${rankedParkings.length})`}</button>
          </div>
          {sheetState === 'medium' && destination && rankedParkings.length > 0 && (
            <div className="recommendation-tabs" aria-label="Parkingjet e rekomanduara">
              {rankedParkings.slice(0, 3).map((match) => (
                <button key={match.parking.id} className={selected.id === match.parking.id ? 'selected' : ''} onClick={() => onSelect(match.parking)} aria-pressed={selected.id === match.parking.id}>
                  <b>{match.rank}</b><span>{match.walkMinutes} min ecje<small>{accessLabel(match.parking)}</small></span>
                </button>
              ))}
            </div>
          )}
          {sheetState === 'medium' && mapParkings.length ? (
            <>
              <ParkingCard parking={selected} smartMatch={selectedMatch} showSource={mapSettings.showDataSources} onOpen={onDetails} />
              <div className="sheet-primary-actions">
                <button className="button" onClick={onNavigate}>Shko këtu</button>
                <button className="button button--secondary" onClick={onDetails}>Detaje</button>
                <a className="button button--secondary" href={streetViewHref} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void handleOpenExternal(streetViewHref) }} aria-label={`Hap Street View 360° për ${selected.name}`}>Street View</a>
              </div>
            </>
          ) : sheetState === 'medium' ? (
            <div className="empty-state">
              <strong>Nuk gjetëm parking në këtë zonë</strong>
              <span>Provo 10 ose 15 minuta ecje.</span>
            </div>
          ) : null}
          {sheetState === 'expanded' && (
            <>
              <section className="expanded-parking-summary" aria-label="Përmbledhja e parkingut të zgjedhur">
                <span><strong>{selected.name}</strong><small>{parkingTypeLabel(selected)} · {accessLabel(selected)}</small></span>
                <span><b>{selected.accessPoint ? 'Hyrje e hartuar' : 'Hyrje e përafërt'}</b><small>{selected.openingHours ?? selected.usageHours ?? 'Orari nuk është konfirmuar'}</small></span>
                <button onClick={onNavigate}>Shko këtu</button>
              </section>
              <div className="parking-list" aria-label="Lista e parkingjeve">
                {sheetParkings.length ? sheetParkings.map((parking) => (
                  <ParkingCard
                    key={parking.id}
                    parking={parking}
                    smartMatch={rankedParkings.find((match) => match.parking.id === parking.id)}
                    showSource={mapSettings.showDataSources}
                    onOpen={() => { onSelect(parking); onDetails() }}
                  />
                )) : <div className="empty-state"><strong>Nuk gjetëm parking</strong><span>Zgjero ecjen ose provo tip tjetër parkingu.</span></div>}
              </div>
            </>
          )}
        </div>
      </section>
      )}

      <BottomNav onSaved={onSaved} onSettings={onSettings} />
    </div>
  )
}

function SavedView({ parkings, showDataSources, userLocation, onHome, onOpen, onSettings }: { parkings: Parking[]; showDataSources: boolean; userLocation?: Parking['coordinates']; onHome: () => void; onOpen: (parking: Parking) => void; onSettings: () => void }) {
  return (
    <div className="screen saved-screen">
      <StatusBar />
      <header className="saved-header"><div><small>Parko</small><h1>Parkingjet e ruajtura</h1></div><span>{parkings.length}</span></header>
      <main className="saved-list">
        <SaveMyParkedLocationCard initialLocation={userLocation} />
        <SmsTariffHelper />
        {parkings.length ? parkings.map((parking) => (
          <ParkingCard key={parking.id} parking={parking} showSource={showDataSources} onOpen={() => onOpen(parking)} />
        )) : <div className="empty-state"><strong>Nuk ke parkingje të ruajtura</strong><span>Prek ＋ te detajet e një parkingu për ta ruajtur.</span></div>}
      </main>
      <BottomNav active="saved" onHome={onHome} onSaved={() => undefined} onSettings={onSettings} />
    </div>
  )
}

const mapVariantOptions: Array<{ value: MapVariant; label: string; description: string; badge: string }> = [
  { value: 'standard', label: 'Standard', description: 'Harta aktuale OpenStreetMap', badge: 'Aktuale' },
  { value: 'minimal', label: 'Minimal', description: 'Varianti i mëparshëm CARTO', badge: 'E mëparshme' },
]

const parkingPaletteOptions: Array<{ value: ParkingPalette; label: string; description: string }> = [
  { value: 'green', label: 'E gjelbër', description: 'Maksimum dukshmërie' },
  { value: 'price', label: 'Sipas çmimit', description: 'Ngjyrat e legjendës' },
  { value: 'operator', label: 'Sipas operatorit', description: 'Prishtina Parking / OSM / privat' },
]

function SettingsView({ settings, preferredType, walkingMinutes, typeCounts, onChange, onPreferredType, onWalkingMinutes, onReset, onHome, onSaved }: { settings: MapSettings; preferredType: ParkingTypeFilter; walkingMinutes: 5 | 10 | 15; typeCounts: ParkingTypeCounts; onChange: (settings: MapSettings) => void; onPreferredType: (type: ParkingTypeFilter) => void; onWalkingMinutes: (minutes: 5 | 10 | 15) => void; onReset: () => void; onHome: () => void; onSaved: () => void }) {
  const toggle = (key: 'emphasizeAreas' | 'largePointMarkers' | 'showPointParking' | 'largeLabels' | 'showDataSources') => onChange({ ...settings, [key]: !settings[key] })
  return (
    <div className="screen settings-screen">
      <StatusBar />
      <header className="settings-header">
        <div><small>Parko</small><h1>Cilësimet e hartës</h1><p>Personalizo dukshmërinë pa ndryshuar të dhënat.</p></div>
        <button onClick={onReset}>Rivendos</button>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <div className="settings-section__heading"><span><small>Stili</small><h2>Varianti i hartës</h2></span><b>2 variante</b></div>
          <div className="map-variant-grid">
            {mapVariantOptions.map((option) => (
              <button key={option.value} className={settings.variant === option.value ? 'selected' : ''} onClick={() => onChange({ ...settings, variant: option.value })} aria-pressed={settings.variant === option.value}>
                <span className={`map-variant-preview map-variant-preview--${option.value}`}><i /><i /><i /><b>P</b></span>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                <em>{option.badge}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__heading"><span><small>Parkingjet</small><h2>Ngjyrat</h2></span></div>
          <div className="parking-palette-options">
            {parkingPaletteOptions.map((option) => (
              <button key={option.value} className={settings.parkingPalette === option.value ? 'selected' : ''} onClick={() => onChange({ ...settings, parkingPalette: option.value })} aria-pressed={settings.parkingPalette === option.value}>
                <span className={`palette-swatch palette-swatch--${option.value}`}><i /><i /><i /></span>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                <b>{settings.parkingPalette === option.value ? '✓' : ''}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section settings-section--toggles">
          <div className="settings-section__heading"><span><small>Dukshmëria</small><h2>Zonat dhe pikat</h2></span></div>
          <button role="switch" aria-checked={settings.emphasizeAreas} onClick={() => toggle('emphasizeAreas')}><span><strong>Zona më të dukshme</strong><small>Forcon vetëm kufijtë realë të parkingjeve.</small></span><i className={settings.emphasizeAreas ? 'on' : ''} /></button>
          <button role="switch" aria-checked={settings.largePointMarkers} onClick={() => toggle('largePointMarkers')}><span><strong>Parkingje më të mëdha</strong><small>Rrit pikat vetëm kur zona nuk është e hartuar.</small></span><i className={settings.largePointMarkers ? 'on' : ''} /></button>
          <button role="switch" aria-checked={settings.largeLabels} onClick={() => toggle('largeLabels')}><span><strong>Etiketa më të mëdha</strong><small>Rrit emrat dhe etiketat interaktive të hartës.</small></span><i className={settings.largeLabels ? 'on' : ''} /></button>
          <button role="switch" aria-checked={settings.showDataSources} onClick={() => toggle('showDataSources')}><span><strong>Shfaq burimin e të dhënave</strong><small>Tregon Prishtina Parking, OSM ose të pakonfirmuar.</small></span><i className={settings.showDataSources ? 'on' : ''} /></button>
          <button role="switch" aria-checked={settings.showPointParking} onClick={() => toggle('showPointParking')}><span><strong>Shfaq parkingjet pa kontur</strong><small>Çaktivizoje për të parë vetëm zonat me kufij realë.</small></span><i className={settings.showPointParking ? 'on' : ''} /></button>
        </section>

        <section className="settings-section settings-section--defaults">
          <div className="settings-section__heading"><span><small>Preferencat</small><h2>Kërkimi i parkingut</h2></span></div>
          <label><span><strong>Lloji i preferuar</strong><small>Përdoret si filtër fillestar.</small></span><select value={preferredType} onChange={(event) => onPreferredType(event.target.value as ParkingTypeFilter)}>{parkingTypeOptions.map(([value, label]) => <option key={value} value={value} disabled={value !== 'all' && typeCounts[value] === 0}>{label}</option>)}</select></label>
          <label><span><strong>Ecja maksimale</strong><small>Rrezja kur kërkon pranë destinacionit.</small></span><select value={walkingMinutes} onChange={(event) => onWalkingMinutes(Number(event.target.value) as 5 | 10 | 15)}><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
        </section>

        <p className="settings-data-note"><b>Pa zona të rreme.</b> Mbushja e plotë përdoret vetëm kur OpenStreetMap ka kufij realë. Parkingjet me vetëm një koordinatë mbeten pika, por mund të shfaqen më të mëdha.</p>
      </main>
      <BottomNav active="settings" onHome={onHome} onSaved={onSaved} onSettings={() => undefined} />
    </div>
  )
}

function DetailsView({ parking, report, onReport, route, destination, smartMatch, saved, userLocation, userLocationLive, userLocationAccuracy, mapSettings, onToggleSaved, onBack, onNavigate }: { parking: Parking; report?: ParkingReport; onReport: (parkingId: string, patch: ParkingReportPatch) => void; route: DrivingRoute | null; destination: Destination | null; smartMatch?: RankedParking; saved: boolean; userLocation: Parking['coordinates']; userLocationLive: boolean; userLocationAccuracy: number | null; mapSettings: MapSettings; onToggleSaved: () => void; onBack: () => void; onNavigate: () => void }) {
  const [reportOpen, setReportOpen] = useState(false)
  const routeMinutes = route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : parking.driveMinutes
  const routeDistance = route?.distanceMeters ?? parking.distanceMeters
  const categoryLabel = municipalCategoryLabel(parking)
  const usefulRouteSteps = (route?.steps ?? []).filter((step) => step.maneuverType !== 'depart').slice(0, 4)
  const routeSourceLabel = route?.source === 'osrm' ? 'Rutë reale nga rrjeti rrugor' : route ? 'Rutë paraprake' : 'Duke llogaritur rutën…'
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[parking]} selected={parking} onSelect={() => undefined} mode="details" route={route} destination={destination} userLocation={userLocation} userLocationLive={userLocationLive} userLocationAccuracy={userLocationAccuracy} mapSettings={mapSettings} />
      <button className="floating-back" onClick={onBack} aria-label="Kthehu">‹</button>
      <button className={`floating-add ${saved ? 'floating-add--saved' : ''}`} onClick={onToggleSaved} aria-label={saved ? 'Hiqe parkingun nga të ruajturat' : 'Ruaje parkingun'}>{saved ? '♥' : '♡'}</button>

      <section className="details-sheet">
        <div className="drag-handle" />
        <h1>{parking.name}</h1>
        <span className={`availability-badge availability-badge--${parking.status}`}>● {availabilityLabel(parking)}</span>
        {mapSettings.showDataSources && <DataTrustBadge parking={parking} detailed />}
        <p className="muted-copy">{accessLabel(parking)}{mapSettings.showDataSources ? ` • ${parkingSourceLabel(parking)}` : ''}{parking.availabilitySource ? ` • Disponueshmëri nga ${parking.availabilitySource}` : ''}</p>

        <div className={`stat-grid ${verifiedPriceLabel(parking) ? '' : 'stat-grid--two'}`}>
          <div><span>Largësia</span><strong>{routeDistance >= 1000 ? `${(routeDistance / 1000).toFixed(1)} km` : `${routeDistance} m`}</strong></div>
          <div><span>Koha</span><strong>{routeMinutes} min</strong></div>
          {verifiedPriceLabel(parking) && <div><span>Çmimi</span><strong>{verifiedPriceLabel(parking)}</strong></div>}
        </div>

        <section className="parking-route-card" aria-label="Rruga deri te parkingu">
          <header><span><small>Si të shkosh</small><strong>Rruga deri te hyrja</strong></span><b>{routeSourceLabel}</b></header>
          <div className="parking-entry-note">
            <i>↗</i>
            <span><strong>{parking.accessPoint ? 'Hyrja e parkingut është e hartuar' : 'Hyrja është llogaritur nga konturi më i afërt'}</strong><small>{parking.address}</small></span>
          </div>
          {usefulRouteSteps.length ? (
            <ol>
              {usefulRouteSteps.map((step, index) => (
                <li key={`${step.maneuverType}-${step.roadName}-${index}`}>
                  <b>{index + 1}</b>
                  <span><strong>{step.instruction}</strong><small>{step.roadName} • {step.distanceMeters >= 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} km` : `${step.distanceMeters} m`}</small></span>
                </li>
              ))}
            </ol>
          ) : <p>Rruga po përgatitet. Mund të nisësh navigimin sapo të shfaqet vija blu në hartë.</p>}
        </section>
        <a className="street-view-inline street-view-inline--details" href={googleStreetViewUrl(parking)} target="_blank" rel="noreferrer" aria-label={`Hap Street View 360° për ${parking.name}`}>◎ Hap Street View 360°</a>

        <h2>Detajet</h2>
        <div className="detail-tags">
          {parking.open24h && <span>24/7 hapur</span>}
          {parking.covered && <span>I mbuluar</span>}
          {parking.cardPayment && <span>Pagesë me kartë</span>}
          {parking.evCharging && <span>EV charging</span>}
        </div>
        <p className="muted-copy">{parking.address}{parking.geometry?.length ? ' • Konturi real është i hartuar' : ' • Konturi nuk është hartuar ende'}</p>
        {parking.municipalManaged ? (
          <section className="municipal-data-card">
            <header><strong>Prishtina Parking</strong><span>E identifikuar nga operatori</span></header>
            <div>
              {parking.municipalZone && <span><small>Zona</small><b>{parking.municipalZone}</b></span>}
              {categoryLabel && <span><small>Kategoria</small><b>{categoryLabel}</b></span>}
              {parking.municipalCode && <span><small>Kodi</small><b>{parking.municipalCode}</b></span>}
            </div>
            <p>{parking.usageHours ?? 'Orari specifik nuk është publikuar në të dhënat e këtij parkingu; kontrollo tabelën në hyrje.'}</p>
            <small>{parking.pricingSource === 'official-zone' ? 'Tarifa e vizitorit nga rregullorja zyrtare e zonës.' : parking.pricingSource === 'osm-sign' ? 'Tarifa vjen nga etiketa e publikuar në OpenStreetMap; kontrollo tabelën lokale.' : 'Tarifa nuk supozohet pa të dhëna të verifikueshme.'}</small>
            <a href={PRISHTINA_PARKING_RULES_URL} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void handleOpenExternal(PRISHTINA_PARKING_RULES_URL) }}>Shiko rregullat zyrtare</a>
          </section>
        ) : (
          <p className="unverified-parking-note"><strong>Jo e konfirmuar si Prishtina Parking.</strong> {parking.pricingSource === 'osm-sign' ? 'Tarifa e shfaqur vjen nga OpenStreetMap; zona zyrtare dhe orari nuk dihen.' : 'Çmimi, zona zyrtare dhe orari nuk plotësohen pa burim të verifikueshëm.'}</p>
        )}
        {destination && smartMatch && <p className="walk-after-parking">Pastaj <strong>{smartMatch.walkMinutes} min ecje</strong> deri te {destination.name}</p>}

        <section className="details-community">
          <h2>Komuniteti</h2>
          <AlertBanner zone={parking.zone} />
          <SpotVouching parking={parking} />
          <LeavingButton parking={parking} />
          <div className="report-control-row report-control-row--details">
            <button
              className={`report-warning-button ${reportOpen ? 'report-warning-button--active' : ''}`}
              onClick={() => setReportOpen((value) => !value)}
              aria-expanded={reportOpen}
              aria-label={reportOpen ? 'Mbyll raportimet' : 'Hap raportimet'}
            >
              <span>⚠</span>
              <b>Raporto</b>
            </button>
          </div>
          {reportOpen && <ParkingReportPanel parking={parking} report={report} onReport={onReport} />}
        </section>

        {parking.osmUrl
          ? <a className="text-button report-link" href={parking.osmUrl} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void handleOpenExternal(parking.osmUrl!) }}>Kontrollo ose korrigjo në OpenStreetMap</a>
          : <span className="text-button report-link report-link--disabled">Burimi nuk ka faqe raportimi</span>}
      </section>
      <div className="details-actions">
        <button className="button" onClick={onNavigate}>Nisu drejt parkingut</button>
      </div>
    </div>
  )
}

function NavigationView({ parking, route, userLocation, userLocationLive, userLocationAccuracy, mapSettings, recenterToken, hasDestination, onRecenter, onStop, onArrive }: { parking: Parking; route: DrivingRoute | null; userLocation: Parking['coordinates']; userLocationLive: boolean; userLocationAccuracy: number | null; mapSettings: MapSettings; recenterToken: number; hasDestination: boolean; onRecenter: () => void; onStop: () => void; onArrive: () => void }) {
  const [showSteps, setShowSteps] = useState(false)
  const directionRef = useRef<HTMLElement>(null)
  const stepsRef = useRef<HTMLElement>(null)
  const nextStep = route?.steps.find((step) => !['depart', 'arrive'].includes(step.maneuverType)) ?? route?.steps[0]
  const routeMinutes = route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : parking.driveMinutes
  const routeDistance = route?.distanceMeters ?? parking.distanceMeters
  const turnIcon = nextStep?.instruction.includes('majtas') ? '↰' : nextStep?.instruction.includes('djathtas') ? '↱' : '↑'
  const arrivalTime = new Intl.DateTimeFormat('sq-AL', { hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(Date.now() + routeMinutes * 60_000))
  useEffect(() => {
    if (!showSteps) return
    const closeSteps = (event: PointerEvent) => {
      const target = event.target as Node
      if (!directionRef.current?.contains(target) && !stepsRef.current?.contains(target)) setShowSteps(false)
    }
    document.addEventListener('pointerdown', closeSteps)
    return () => document.removeEventListener('pointerdown', closeSteps)
  }, [showSteps])
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[]} selected={parking} onSelect={() => undefined} mode="navigation" route={route} recenterToken={recenterToken} userLocation={userLocation} userLocationLive={userLocationLive} userLocationAccuracy={userLocationAccuracy} mapSettings={mapSettings} />

      <section className="direction-card" ref={directionRef}>
        <span className="turn-icon">{turnIcon}</span>
        <div><small>{nextStep ? `Pas ${Math.max(20, nextStep.distanceMeters)} metrash` : 'Duke llogaritur rutën'}</small><strong>{nextStep?.instruction ?? 'Gjetja e rrugës më të mirë…'}</strong><span>{nextStep ? `në ${nextStep.roadName}` : 'OSRM routing'}</span></div>
        <button onClick={() => setShowSteps((value) => !value)} aria-label={showSteps ? 'Mbyll udhëzimet' : 'Më shumë udhëzime'}>{showSteps ? '×' : '＋'}</button>
      </section>

      {showSteps && (
        <section className="route-steps-card" aria-label="Udhëzimet e rutës" ref={stepsRef}>
          <strong>Hapat e rutës</strong>
          {(route?.steps ?? []).filter((step) => step.maneuverType !== 'depart').slice(0, 6).map((step, index) => (
            <div key={`${step.maneuverType}-${index}`}><b>{index + 1}</b><span>{step.instruction}<small>{step.roadName} • {step.distanceMeters} m</small></span></div>
          ))}
          {!route?.steps.length && <p>Udhëzimet po llogariten…</p>}
        </section>
      )}

      <button className="navigation-recenter" onClick={onRecenter} aria-label="Rikthe hartën te lokacioni im">⌖</button>

      <span className="preview-badge">PARAPAMJE</span>
      <section className="arrival-card">
        <div><small>Drejt {parking.name}</small><strong>{arrivalTime}</strong></div>
        <b>{routeMinutes} min • {routeDistance >= 1000 ? `${(routeDistance / 1000).toFixed(1)} km` : `${routeDistance} m`}</b>
        <span className="confidence-badge">● {parking.spaces !== null ? `${parking.spaces} vende të lira` : accessLabel(parking)}</span>
        <button className="stop-button" onClick={(event) => { event.stopPropagation(); onStop() }}><i />Ndalo</button>
        <button className="arrival-hint" onClick={(event) => { event.stopPropagation(); onArrive() }}>{hasDestination ? 'Parkova • vazhdo në këmbë' : 'Parkova • përfundo navigimin'}</button>
      </section>
    </div>
  )
}

function WalkingView({ parking, destination, route, match, directionsHref, userLocation, userLocationLive, userLocationAccuracy, mapSettings, onFinish }: { parking: Parking; destination: Destination; route: DrivingRoute; match: RankedParking; directionsHref: string; userLocation: Parking['coordinates']; userLocationLive: boolean; userLocationAccuracy: number | null; mapSettings: MapSettings; onFinish: () => void }) {
  const routeMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60))
  const isRealRoute = route.source === 'valhalla'
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[parking]} selected={parking} onSelect={() => undefined} mode="walking" route={route} destination={destination} userLocation={userLocation} userLocationLive={userLocationLive} userLocationAccuracy={userLocationAccuracy} mapSettings={mapSettings} />

      <section className="direction-card direction-card--walking">
        <span className="turn-icon">↑</span>
        <div><small>{isRealRoute ? 'Rutë këmbësorësh' : 'Distancë e përafërt'}</small><strong>Drejt {destination.name}</strong><span>{isRealRoute ? 'Rrugë e llogaritur nga Valhalla' : 'Hap alternativën në Google Maps'}</span></div>
        <a href={directionsHref} target="_blank" rel="noreferrer" onClick={(event) => { event.preventDefault(); void handleOpenExternal(directionsHref) }} aria-label="Hap udhëzimet e ecjes">↗</a>
      </section>

      <section className="walking-arrival-card">
        <div><small>MBËRRITJA NË KËMBË</small><strong>{routeMinutes || match.walkMinutes} min</strong><span>{route.distanceMeters || match.walkDistanceMeters} m deri te destinacioni</span></div>
        <button onClick={onFinish}>Përfundo</button>
      </section>
    </div>
  )
}

export default function App() {
  const persistedPreferences = useRef(loadPreferences()).current
  const [screen, setScreen] = useState<Screen>('home')
  const [selected, setSelected] = useState(() => getPrishtinaParkingSnapshot().find((parking) => parking.id === persistedPreferences.selectedParkingId) ?? defaultParking)
  const [filters, setFilters] = useState<Filters>(() => ({ ...initialFilters, ...persistedPreferences.filters }))
  const [mapSettings, setMapSettings] = useState<MapSettings>(() => normalizedMapSettings(persistedPreferences.mapSettings))
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [parkings, setParkings] = useState<Parking[]>(getPrishtinaParkingSnapshot)
  const [loadStatus, setLoadStatus] = useState<ParkingLoadStatus>('loading')
  const [route, setRoute] = useState<DrivingRoute | null>(null)
  const [walkingRoute, setWalkingRoute] = useState<DrivingRoute | null>(null)
  const [destination, setDestination] = useState<Destination | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [onlineSearchResults, setOnlineSearchResults] = useState<Destination[]>([])
  const [searchingOnline, setSearchingOnline] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [recentDestinations, setRecentDestinations] = useState<Destination[]>(loadRecentDestinations)
  const [walkingMinutes, setWalkingMinutes] = useState<5 | 10 | 15>(() => [5, 10, 15].includes(persistedPreferences.walkingMinutes ?? 10) ? persistedPreferences.walkingMinutes ?? 10 : 10)
  const [preference, setPreference] = useState<ParkingPreference>('best')
  const [showAllResults, setShowAllResults] = useState(true)
  const [drivingMatrix, setDrivingMatrix] = useState<DrivingMatrixEntry[]>([])
  const [pickingDestination, setPickingDestination] = useState(false)
  const [parkingPreviewOpen, setParkingPreviewOpen] = useState(false)
  const [recenterToken, setRecenterToken] = useState(0)
  const [savedParkingIds, setSavedParkingIds] = useState<Set<string>>(() => new Set(persistedPreferences.savedParkingIds ?? []))
  const [parkingReports, setParkingReports] = useState<Record<string, ParkingReport>>(loadParkingReports)
  const [userLocation, setUserLocation] = useState(USER_LOCATION)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const parkingSelectedByUserRef = useRef(false)
  const parkingDetailsAttemptedRef = useRef(new Set<string>())
  const onlineSearchRequestRef = useRef(0)
  const userLocationInPrishtina = locationStatus === 'ready' && isWithinPrishtinaMap(userLocation)
  const activeUserLocation = userLocationInPrishtina ? userLocation : USER_LOCATION

  useEffect(() => {
    const controller = new AbortController()
    setRoute(null)
    const entrance = parkingAccessPoint(selected, activeUserLocation)
    loadDrivingRoute(activeUserLocation, entrance, controller.signal)
      .then(setRoute)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRoute(null)
          captureEvent('driving_route_failed')
        }
      })
    return () => controller.abort()
  }, [selected, activeUserLocation.lat, activeUserLocation.lng])

  useEffect(() => {
    savePreferences({ filters, savedParkingIds: [...savedParkingIds], selectedParkingId: selected.id, mapSettings, walkingMinutes })
  }, [filters, savedParkingIds, selected.id, mapSettings, walkingMinutes])

  useEffect(() => {
    if (selected.id.startsWith('osm-node-') || parkingDetailsAttemptedRef.current.has(selected.id)) return
    parkingDetailsAttemptedRef.current.add(selected.id)
    const controller = new AbortController()
    loadParkingGeometry(selected, controller.signal)
      .then((details) => {
        if (!details.geometry?.length && !details.accessPoint) return
        setParkings((current) => current.map((parking) => parking.id === selected.id ? { ...parking, ...details } : parking))
        setSelected((current) => current.id === selected.id ? { ...current, ...details } : current)
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) return
      })
    return () => controller.abort()
  }, [selected.id])

  useEffect(() => {
    const controller = new AbortController()
    loadPrishtinaParkings(controller.signal)
      .then((results) => {
        setParkings(results)
        setLoadStatus('live')
        const restored = results.find((parking) => parking.id === persistedPreferences.selectedParkingId)
        if (restored) setSelected(restored)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setParkings(getPrishtinaParkingSnapshot())
        setLoadStatus('fallback')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let disposed = false
    const refresh = async () => {
      const controller = new AbortController()
      try {
        const feed = await loadVerifiedAvailability(controller.signal)
        if (feed && !disposed) {
          setParkings((current) => mergeVerifiedAvailability(current, feed))
          captureEvent('occupancy_feed_refreshed', { source: feed.source, count: feed.parkings.length })
        }
      } catch { captureEvent('occupancy_feed_failed') }
      return controller
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 60_000)
    return () => { disposed = true; window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  function updateLocationFromPosition(position: GeolocationPosition, options: { recenter: boolean; report?: boolean }) {
    const nextLocation = { lat: position.coords.latitude, lng: position.coords.longitude }
    const insidePrishtina = isWithinPrishtinaMap(nextLocation)
    setUserLocation(nextLocation)
    setLocationAccuracy(Math.round(position.coords.accuracy))
    setLocationStatus(insidePrishtina ? 'ready' : 'outside')
    if (options.recenter && insidePrishtina) setRecenterToken((value) => value + 1)
    if (options.report) {
      captureEvent('location_ready', {
        accuracyBucket: position.coords.accuracy < 30 ? 'high' : position.coords.accuracy < 100 ? 'medium' : 'low',
        coverage: insidePrishtina ? 'prishtina' : 'outside-prishtina',
      })
    }
  }

  useEffect(() => {
    if ((locationStatus !== 'ready' && locationStatus !== 'outside') || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => updateLocationFromPosition(position, { recenter: false }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setLocationStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [locationStatus])

  useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions) return
    let disposed = false
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        if (!disposed && permission.state === 'granted') requestUserLocation()
      })
      .catch(() => undefined)
    return () => { disposed = true }
  }, [])

  const reportedParkings = useMemo(() => parkings.map((parking) => applyParkingReport(parking, parkingReports[parking.id])), [parkings, parkingReports])
  const locatedParkings = useMemo(() => reportedParkings.map((parking) => ({
    ...parking,
    distanceMeters: distanceMeters(activeUserLocation, parking.coordinates),
  })), [reportedParkings, activeUserLocation])
  const currentSelected = locatedParkings.find((parking) => parking.id === selected.id) ?? selected
  const hasLiveAvailability = useMemo(() => locatedParkings.some((parking) => parking.spaces !== null && parking.availabilitySource), [locatedParkings])
  const effectiveFilters = useMemo(() => filtersForAvailability(filters, hasLiveAvailability), [filters, hasLiveAvailability])
  const workflowFilters = effectiveFilters
  const filteredParkings = useMemo(() => locatedParkings
    .filter((parking) => matchesFilters(parking, workflowFilters))
    .sort((first, second) => first.distanceMeters - second.distanceMeters), [workflowFilters, locatedParkings])

  const localSearchResults = useMemo(() => searchLocalDestinations(query), [query])
  const searchResults = useMemo(() => {
    const seen = new Set<string>()
    return [...localSearchResults, ...onlineSearchResults].filter((result) => {
      const key = `${result.name.toLowerCase()}-${result.coordinates.lat.toFixed(4)}-${result.coordinates.lng.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 9)
  }, [localSearchResults, onlineSearchResults])

  const candidates = useMemo(
    () => destination ? walkableParkingCandidates(filteredParkings, destination, walkingMinutes) : [],
    [destination, filteredParkings, walkingMinutes],
  )
  const typeCountSource = useMemo(
    () => destination ? walkableParkingCandidates(locatedParkings, destination, walkingMinutes).map(({ parking }) => parking) : locatedParkings,
    [destination, locatedParkings, walkingMinutes],
  )
  const typeCounts = useMemo<ParkingTypeCounts>(() => ({
    all: typeCountSource.length,
    public: typeCountSource.filter((parking) => parkingMatchesType(parking, 'public')).length,
    private: typeCountSource.filter((parking) => parkingMatchesType(parking, 'private')).length,
    street: typeCountSource.filter((parking) => parkingMatchesType(parking, 'street')).length,
    municipal: typeCountSource.filter((parking) => parkingMatchesType(parking, 'municipal')).length,
  }), [typeCountSource])
  const globalTypeCounts = useMemo<ParkingTypeCounts>(() => ({
    all: locatedParkings.length,
    public: locatedParkings.filter((parking) => parkingMatchesType(parking, 'public')).length,
    private: locatedParkings.filter((parking) => parkingMatchesType(parking, 'private')).length,
    street: locatedParkings.filter((parking) => parkingMatchesType(parking, 'street')).length,
    municipal: locatedParkings.filter((parking) => parkingMatchesType(parking, 'municipal')).length,
  }), [locatedParkings])
  const featureCounts = useMemo<ParkingFeatureCounts>(() => ({
    verified: typeCountSource.filter((parking) => parking.confidence !== 'low').length,
    free: typeCountSource.filter((parking) => parking.free && parking.pricingSource).length,
    paid: typeCountSource.filter((parking) => parking.pricePerHour !== null && parking.pricePerHour > 0 && parking.pricingSource).length,
    ev: typeCountSource.filter((parking) => parking.evCharging).length,
    accessible: typeCountSource.filter((parking) => parking.accessible).length,
    live: typeCountSource.filter((parking) => parking.spaces !== null && parking.availabilitySource).length,
  }), [typeCountSource])
  const candidateKey = candidates.map(({ parking }) => parking.id).join('|')

  useEffect(() => {
    if (!destination || !candidates.length) {
      setDrivingMatrix([])
      return
    }
    const controller = new AbortController()
    setDrivingMatrix([])
    loadDrivingMatrix(activeUserLocation, candidates.map(({ parking }) => parking), controller.signal)
      .then(setDrivingMatrix)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setDrivingMatrix([])
      })
    return () => controller.abort()
  }, [candidateKey, destination, activeUserLocation.lat, activeUserLocation.lng])

  const rankedParkings = useMemo(
    () => rankParkings(candidates, drivingMatrix, preference),
    [candidates, drivingMatrix, preference],
  )
  const mapRankedParkings = showAllResults ? rankedParkings : rankedParkings.slice(0, 3)
  const mapParkings = destination ? mapRankedParkings.map(({ parking }) => parking) : filteredParkings
  const selectedRankedParking = rankedParkings.find((match) => match.parking.id === currentSelected.id)
  const selectedWalkingDirectionsHref = useMemo(() => destination ? walkingDirectionsUrl(currentSelected, destination) : '', [currentSelected, destination])

  useEffect(() => {
    if (!destination) {
      parkingSelectedByUserRef.current = false
      return
    }
    if (rankedParkings.length && !parkingSelectedByUserRef.current && selected.id !== rankedParkings[0].parking.id) {
      setSelected(rankedParkings[0].parking)
    }
  }, [destination, rankedParkings, selected.id])
  useEffect(() => {
    if (!destination || !selectedRankedParking) { setWalkingRoute(null); return }
    const controller = new AbortController()
    setWalkingRoute(null)
    const start = parkingAccessPoint(selectedRankedParking.parking, destination.coordinates)
    loadWalkingRoute(start, destination.coordinates, controller.signal)
      .then(setWalkingRoute)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) captureEvent('walking_route_failed')
      })
    return () => controller.abort()
  }, [destination, selectedRankedParking])

  const displayedWalkingRoute = useMemo<DrivingRoute | null>(() => {
    if (walkingRoute) return walkingRoute
    if (!destination || !selectedRankedParking) return null
    const start = parkingAccessPoint(selectedRankedParking.parking, destination.coordinates)
    return {
      coordinates: [start, destination.coordinates],
      distanceMeters: selectedRankedParking.walkDistanceMeters,
      durationSeconds: selectedRankedParking.walkMinutes * 60,
      steps: [{ instruction: `Ec drejt ${destination.name}`, roadName: destination.subtitle, distanceMeters: selectedRankedParking.walkDistanceMeters, maneuverType: 'walk' }],
      source: 'estimated-walking',
    }
  }, [destination, selectedRankedParking, walkingRoute])

  async function runOnlineSearch() {
    if (query.trim().length < 2 || searchingOnline) return
    const searchTerm = query.trim()
    const requestId = ++onlineSearchRequestRef.current
    setSearchOpen(true)
    setSearchError('')
    if (!online) {
      setSearchError('Je offline. Përdor sugjerimet lokale ose provo përsëri kur lidhet interneti.')
      return
    }
    setSearchingOnline(true)
    try {
      const results = await searchDestinationOnline(searchTerm)
      if (requestId !== onlineSearchRequestRef.current) return
      setOnlineSearchResults(results)
      if (!results.length) setSearchError('Nuk u gjet asnjë rezultat online. Provo emrin e rrugës ose zonës.')
    } catch {
      if (requestId !== onlineSearchRequestRef.current) return
      setOnlineSearchResults([])
      setSearchError('Kërkimi online dështoi. Provo përsëri.')
    } finally {
      if (requestId === onlineSearchRequestRef.current) setSearchingOnline(false)
    }
  }

  function rememberDestination(nextDestination: Destination) {
    setRecentDestinations((current) => {
      const next = [nextDestination, ...current.filter((item) => item.id !== nextDestination.id && (Math.abs(item.coordinates.lat - nextDestination.coordinates.lat) > .00001 || Math.abs(item.coordinates.lng - nextDestination.coordinates.lng) > .00001))].slice(0, 5)
      try { localStorage.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(next)) } catch { /* storage can be unavailable */ }
      return next
    })
  }

  function selectDestination(nextDestination: Destination) {
    onlineSearchRequestRef.current += 1
    setSearchingOnline(false)
    parkingSelectedByUserRef.current = false
    setDestination(nextDestination)
    setQuery(nextDestination.name)
    setParkingPreviewOpen(false)
    setSearchOpen(false)
    setOnlineSearchResults([])
    setSearchError('')
    setShowAllResults(true)
    setPickingDestination(false)
    rememberDestination(nextDestination)
  }

  function clearDestination() {
    onlineSearchRequestRef.current += 1
    setSearchingOnline(false)
    setDestination(null)
    setQuery('')
    setSearchOpen(false)
    setOnlineSearchResults([])
    setSearchError('')
    setShowAllResults(true)
    setPickingDestination(false)
    setParkingPreviewOpen(false)
  }

  function toggleMapDestinationPicker() {
    if (pickingDestination) {
      setPickingDestination(false)
      return
    }
    setQuery(destination?.name ?? '')
    onlineSearchRequestRef.current += 1
    setSearchingOnline(false)
    setSearchOpen(false)
    setOnlineSearchResults([])
    setSearchError('')
    setParkingPreviewOpen(false)
    setPickingDestination(true)
  }

  async function pickDestinationOnMap(coordinates: { lat: number; lng: number }) {
    const pendingDestination: Destination = {
      id: `map-${coordinates.lat.toFixed(5)}-${coordinates.lng.toFixed(5)}`,
      name: 'Pika e zgjedhur',
      subtitle: 'Duke identifikuar rrugën…',
      category: 'place',
      coordinates,
      aliases: [],
      source: 'map',
    }
    selectDestination(pendingDestination)
    try {
      const resolved = await reverseGeocodeLocation(coordinates)
      setDestination((current) => current?.id === pendingDestination.id ? resolved : current)
      setQuery((current) => current === pendingDestination.name ? resolved.name : current)
      rememberDestination(resolved)
    } catch {
      setDestination((current) => current?.id === pendingDestination.id ? { ...pendingDestination, subtitle: 'Destinacion nga harta' } : current)
    }
  }

  function selectParking(nextParking: Parking) {
    parkingSelectedByUserRef.current = true
    setRoute(null)
    setSelected(nextParking)
    setParkingPreviewOpen(true)
  }

  function reportParking(parkingId: string, patch: ParkingReportPatch) {
    setParkingReports((current) => {
      const nextReport = { ...(current[parkingId] ?? { parkingId }), ...patch, updatedAt: Date.now() }
      const next = { ...current, [parkingId]: nextReport }
      saveParkingReports(next)
      return next
    })
  }

  function toggleSavedParking() {
    setSavedParkingIds((current) => {
      const next = new Set(current)
      if (next.has(selected.id)) next.delete(selected.id)
      else next.add(selected.id)
      return next
    })
  }

  function requestUserLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      setLocationAccuracy(null)
      return
    }
    setLocationStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => updateLocationFromPosition(position, { recenter: true, report: true }),
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        setLocationAccuracy(null)
        captureEvent('location_failed', { code: error.code })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    const selectable = destination ? rankedParkings : filteredParkings
    if (selectable.length) {
      const selectableParkings = destination ? (selectable as RankedParking[]).map((match) => match.parking) : selectable as Parking[]
      if (!selectableParkings.some((parking) => parking.id === selected.id)) setSelected(selectableParkings[0])
    }
  }, [destination, filteredParkings, rankedParkings, selected.id])

  return (
    <div className="app-shell">
      {!online && <div className="offline-banner" role="status">Je offline — po shfaqim të dhënat e fundit të ruajtura.</div>}
      <div className="phone-frame">
        <IosInstallPrompt />
        {screen === 'home' && (
          <HomeView
            mapParkings={mapParkings}
            selected={currentSelected}
            filters={workflowFilters}
            hasLiveAvailability={hasLiveAvailability}
            query={query}
            onQuery={(value) => { onlineSearchRequestRef.current += 1; setSearchingOnline(false); setQuery(value); setSearchOpen(true); setOnlineSearchResults([]); setSearchError('') }}
            searchResults={searchResults}
            recentDestinations={recentDestinations}
            searchOpen={searchOpen}
            searchingOnline={searchingOnline}
            searchError={searchError}
            online={online}
            destination={destination}
            walkingMinutes={walkingMinutes}
            preference={preference}
            route={route}
            rankedParkings={rankedParkings}
            showAllResults={showAllResults}
            pickingDestination={pickingDestination}
            parkingPreviewOpen={parkingPreviewOpen}
            typeCounts={typeCounts}
            featureCounts={featureCounts}
            onSelect={selectParking}
            onSelectDestination={selectDestination}
            onClearRecent={() => { setRecentDestinations([]); try { localStorage.removeItem(RECENT_DESTINATIONS_KEY) } catch { /* storage can be unavailable */ } }}
            onSearchFocus={() => setSearchOpen(true)}
            onSearchOnline={runOnlineSearch}
            onCloseSearch={() => setSearchOpen(false)}
            onClearDestination={clearDestination}
            onWalkingMinutes={setWalkingMinutes}
            onPreference={setPreference}
            onParkingType={(type) => setFilters((current) => ({ ...current, type }))}
            onFiltersChange={setFilters}
            onToggleShowAll={() => setShowAllResults((value) => !value)}
            onStartMapPick={toggleMapDestinationPicker}
            onPickDestination={pickDestinationOnMap}
            recenterToken={recenterToken}
            onRecenter={requestUserLocation}
            locationStatus={locationStatus}
            locationAccuracy={locationAccuracy}
            userLocation={activeUserLocation}
            onDetails={() => setScreen('details')}
            onNavigate={() => setScreen('navigation')}
            streetViewHref={googleStreetViewUrl(currentSelected)}
            onCloseParkingPreview={() => setParkingPreviewOpen(false)}
            onSaved={() => setScreen('saved')}
            onSettings={() => setScreen('settings')}
            mapSettings={mapSettings}
            loadStatus={loadStatus}
          />
        )}
        {screen === 'saved' && <SavedView parkings={locatedParkings.filter((parking) => savedParkingIds.has(parking.id))} showDataSources={mapSettings.showDataSources} userLocation={userLocationInPrishtina ? activeUserLocation : undefined} onHome={() => setScreen('home')} onSettings={() => setScreen('settings')} onOpen={(parking) => { setSelected(parking); setDestination(null); setScreen('details') }} />}
        {screen === 'settings' && <SettingsView settings={mapSettings} preferredType={filters.type as ParkingTypeFilter} walkingMinutes={walkingMinutes} typeCounts={globalTypeCounts} onChange={(value) => setMapSettings(normalizedMapSettings(value))} onPreferredType={(type) => setFilters((current) => ({ ...current, type }))} onWalkingMinutes={setWalkingMinutes} onReset={() => { setMapSettings(DEFAULT_MAP_SETTINGS); setFilters(initialFilters); setWalkingMinutes(10) }} onHome={() => setScreen('home')} onSaved={() => setScreen('saved')} />}
        {screen === 'details' && <DetailsView parking={currentSelected} report={parkingReports[currentSelected.id]} onReport={reportParking} route={route} destination={destination} smartMatch={selectedRankedParking} saved={savedParkingIds.has(currentSelected.id)} userLocation={activeUserLocation} userLocationLive={userLocationInPrishtina} userLocationAccuracy={locationAccuracy} mapSettings={mapSettings} onToggleSaved={toggleSavedParking} onBack={() => setScreen('home')} onNavigate={() => setScreen('navigation')} />}
        {screen === 'navigation' && <NavigationView parking={currentSelected} route={route} userLocation={activeUserLocation} userLocationLive={userLocationInPrishtina} userLocationAccuracy={locationAccuracy} mapSettings={mapSettings} recenterToken={recenterToken} hasDestination={Boolean(destination)} onRecenter={requestUserLocation} onStop={() => setScreen('details')} onArrive={() => setScreen(destination ? 'walking' : 'home')} />}
        {screen === 'walking' && destination && displayedWalkingRoute && selectedRankedParking && <WalkingView parking={currentSelected} destination={destination} route={displayedWalkingRoute} match={selectedRankedParking} directionsHref={selectedWalkingDirectionsHref} userLocation={activeUserLocation} userLocationLive={userLocationInPrishtina} userLocationAccuracy={locationAccuracy} mapSettings={mapSettings} onFinish={() => setScreen('home')} />}
      </div>
      <p className="desktop-caption">Parko • prototip interaktiv për Prishtinën</p>
    </div>
  )
}
