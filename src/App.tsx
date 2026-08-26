import { useEffect, useMemo, useRef, useState } from 'react'
import { loadVerifiedAvailability, mergeVerifiedAvailability } from './availabilityApi'
import { defaultParking } from './data'
import LiveParkingMap from './LiveParkingMap'
import { reverseGeocodeLocation, searchDestinationOnline, searchLocalDestinations } from './geocodingApi'
import { distanceMeters, rankParkings, walkableParkingCandidates } from './parkingRanking'
import { getPrishtinaParkingSnapshot, loadParkingGeometry, loadPrishtinaParkings, USER_LOCATION } from './parkingApi'
import { parkingAccessPoint } from './parkingGeometry'
import { PRISHTINA_PARKING_RULES_URL } from './prishtinaParkingRules'
import { clearParkedSession, loadParkedSession, loadPreferences, saveParkedSession, savePreferences } from './persistence'
import { requestReminderPermission, scheduleParkingReminder } from './notifications'
import { loadDrivingMatrix, loadDrivingRoute, loadWalkingRoute } from './routingApi'
import { findCarDirectionsUrl, streetViewUrl, walkingDirectionsUrl } from './streetView'
import { captureEvent } from './telemetry'
import type { DrivingMatrixEntry } from './routingApi'
import type { Destination, DrivingRoute, Filters, ParkedSession, Parking, ParkingLoadStatus, ParkingPreference, RankedParking, Screen } from './types'

const initialFilters: Filters = {
  availableOnly: false,
  verifiedOnly: false,
  maxPrice: 2,
  type: 'all',
  freeOnly: false,
  evCharging: false,
  accessible: false,
}

const RECENT_DESTINATIONS_KEY = 'parko-recent-destinations'
const PARKING_REPORTS_KEY = 'parko-live-parking-reports'

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
    label: 'Prishtina Parking',
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

function BottomNav({ active = 'home', onHome, onSaved, onTimer }: { active?: 'home' | 'saved'; onHome?: () => void; onSaved: () => void; onTimer: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navigimi kryesor">
      <button className={`bottom-nav__item ${active === 'home' ? 'bottom-nav__item--active' : ''}`} onClick={onHome} aria-current={active === 'home' ? 'page' : undefined}><span>➤</span>Harta</button>
      <button className={`bottom-nav__item ${active === 'saved' ? 'bottom-nav__item--active' : ''}`} onClick={onSaved} aria-current={active === 'saved' ? 'page' : undefined}><span>♡</span>Ruajtur</button>
      <button className="bottom-nav__item" onClick={onTimer}><span>◷</span>Timeri</button>
    </nav>
  )
}

function ParkingCard({ parking, smartMatch, onOpen }: { parking: Parking; smartMatch?: RankedParking; onOpen: () => void }) {
  const verifiedPrice = parking.pricingSource ? priceLabel(parking) : null
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
        <DataTrustBadge parking={parking} />
      </div>
      <span className="parking-card__chevron" aria-hidden="true">›</span>
    </article>
  )
}

type CommunityStats = {
  reports: number
  freeSignals: number
  policeSignals: number
  municipalParkings: number
}

function ParkingReportPanel({ parking, report, compact = false, onReport, streetViewHref }: { parking: Parking; report?: ParkingReport; compact?: boolean; onReport: (parkingId: string, patch: ParkingReportPatch) => void; streetViewHref: string }) {
  const reportSource = report ? `Raportuar ${reportAgeLabel(report)}` : parking.availabilitySource ? parking.availabilitySource : 'Pa raport komuniteti'
  return (
    <section className={`parking-report-panel ${compact ? 'parking-report-panel--compact' : ''}`} aria-label="Raportimet live per zonen e zgjedhur">
      <header className="parking-report-panel__header">
        <span><small>Live</small><strong>Raporto shpejt</strong></span>
        <b>{reportSource}</b>
      </header>
      <div className="parking-report-panel__status">
        <strong>{reportMessage(parking, report)}</strong>
        <span>{policeRiskLabel(report)}</span>
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
      <a className="street-view-inline" href={streetViewHref} target="_blank" rel="noreferrer"><span>360°</span>Shiko vendin</a>
    </section>
  )
}

function CommunityStrip({ stats, loadStatus }: { stats: CommunityStats; loadStatus: ParkingLoadStatus }) {
  return (
    <section className="community-strip" aria-label="Gjendja live nga komuniteti">
      <div>
        <span className="community-strip__pulse" />
        <span><small>Live community</small><strong>{stats.reports ? `${stats.reports} raporte aktive` : 'Në pritje të raportimeve'}</strong></span>
      </div>
      <span><small>Vende</small><strong>{stats.freeSignals}</strong></span>
      <span><small>Polici</small><strong>{stats.policeSignals}</strong></span>
      <span><small>PP</small><strong>{stats.municipalParkings}</strong></span>
      <b>{loadStatus === 'live' ? 'OSM live' : loadStatus === 'loading' ? 'Sync' : 'Offline'}</b>
    </section>
  )
}

function matchesFilters(parking: Parking, filters: Filters) {
  const matchesAvailability = !filters.availableOnly || parking.status === 'available' || parking.status === 'limited'
  const matchesVerified = !filters.verifiedOnly || parking.confidence !== 'low'
  const matchesPrice = filters.maxPrice >= 2 || (parking.pricePerHour !== null && parking.pricePerHour <= filters.maxPrice)
  const matchesType = filters.type === 'all' || (filters.type === 'municipal' ? Boolean(parking.municipalManaged) : parking.type === filters.type)
  return matchesAvailability && matchesVerified && matchesPrice && matchesType && (!filters.freeOnly || parking.free) && (!filters.evCharging || parking.evCharging) && (!filters.accessible || parking.accessible)
}

function filtersForAvailability(filters: Filters, hasLiveAvailability: boolean): Filters {
  return hasLiveAvailability ? filters : { ...filters, availableOnly: false }
}

function HomeView({
  mapParkings,
  totalCount,
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
  rankedParkings,
  showAllResults,
  pickingDestination,
  onSelect,
  onSelectDestination,
  onClearRecent,
  onSearchFocus,
  onSearchOnline,
  onCloseSearch,
  onClearDestination,
  onWalkingMinutes,
  onPreference,
  onToggleShowAll,
  onStartMapPick,
  onPickDestination,
  communityStats,
  selectedReport,
  onReport,
  streetViewHref,
  recenterToken,
  onRecenter,
  locationStatus,
  userLocation,
  onFilters,
  onDetails,
  onSaved,
  onTimer,
  loadStatus,
}: {
  mapParkings: Parking[]
  totalCount: number
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
  rankedParkings: RankedParking[]
  showAllResults: boolean
  pickingDestination: boolean
  onSelect: (parking: Parking) => void
  onSelectDestination: (destination: Destination) => void
  onClearRecent: () => void
  onSearchFocus: () => void
  onSearchOnline: () => void
  onCloseSearch: () => void
  onClearDestination: () => void
  onWalkingMinutes: (minutes: 5 | 10 | 15) => void
  onPreference: (preference: ParkingPreference) => void
  onToggleShowAll: () => void
  onStartMapPick: () => void
  onPickDestination: (coordinates: { lat: number; lng: number }) => void
  communityStats: CommunityStats
  selectedReport?: ParkingReport
  onReport: (parkingId: string, patch: ParkingReportPatch) => void
  streetViewHref: string
  recenterToken: number
  onRecenter: () => void
  locationStatus: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable'
  userLocation: Parking['coordinates']
  onFilters: () => void
  onDetails: () => void
  onSaved: () => void
  onTimer: () => void
  loadStatus: ParkingLoadStatus
}) {
  const [sheetState, setSheetState] = useState<'collapsed' | 'medium' | 'expanded'>('medium')
  const controlsRef = useRef<HTMLDivElement>(null)
  const selectedMatch = rankedParkings.find((match) => match.parking.id === selected.id)
  const categoryIcon = { building: '▦', street: '↔', area: '⌂', place: '●' }
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
  const activeFilterCount = Number(filters.type !== 'all') + Number(filters.freeOnly) + Number(filters.maxPrice < 2) + Number(filters.availableOnly) + Number(filters.verifiedOnly) + Number(filters.evCharging) + Number(filters.accessible)
  const sheetMatches = destination ? (showAllResults ? rankedParkings : rankedParkings.slice(0, 3)) : []
  const sheetParkings = destination ? sheetMatches.map((match) => match.parking) : mapParkings.slice(0, 30)
  const nextSheetState = sheetState === 'collapsed' ? 'medium' : sheetState === 'medium' ? 'expanded' : 'collapsed'
  const sheetToggleLabel = sheetState === 'collapsed'
    ? `${mapParkings.length} parkingje • Hape`
    : sheetState === 'medium' ? 'Shfaq listën' : 'Mbylle listën'

  useEffect(() => {
    if (!searchOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) onCloseSearch()
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseSearch() }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [searchOpen, onCloseSearch])

  useEffect(() => {
    if (destination) setSheetState('medium')
  }, [destination?.id])

  return (
    <div className={`screen screen--map ${destination ? 'screen--smart' : ''} screen--sheet-${sheetState}`}>
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
        pickingDestination={pickingDestination}
        onPickDestination={onPickDestination}
        recenterToken={recenterToken}
        userLocation={userLocation}
      />

      <div className="home-controls" ref={controlsRef}>
        <div className="search-box">
          <span className="search-box__pin">●</span>
          <span className="search-box__copy">
            <small>Ku po shkon?</small>
            <input
              value={query}
              onFocus={onSearchFocus}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') onSearchOnline() }}
              placeholder="Zonë, rrugë ose ndërtesë"
              aria-label="Kërko destinacion"
            />
          </span>
          {destination ? (
            <button type="button" className="round-button" onClick={onSearchFocus} aria-label="Ndrysho destinacionin">⌕</button>
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
                <span><strong>{result.name}</strong><small>{result.subtitle}</small></span>
                <b>›</b>
              </button>
            ))}
            {localResults.length > 0 && <div className="search-section-label">Sugjerime në Prishtinë</div>}
            {localResults.map((result) => (
              <button key={result.id} onClick={() => onSelectDestination(result)}>
                <i>{categoryIcon[result.category]}</i>
                <span><strong>{result.name}</strong><small>{result.subtitle}</small></span>
                <b>›</b>
              </button>
            ))}
            {remoteResults.length > 0 && <div className="search-section-label">Rezultate online</div>}
            {remoteResults.map((result) => (
              <button key={result.id} onClick={() => onSelectDestination(result)}>
                <i>{categoryIcon[result.category]}</i>
                <span><strong>{result.name}</strong><small>{result.subtitle}</small></span>
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
            <button onClick={onStartMapPick}>
              <i>⌖</i>
              <span><strong>Zgjidh në hartë</strong><small>Prek hyrjen ose lokacionin e saktë</small></span>
              <b>›</b>
            </button>
            {!recentResults.length && !searchResults.length && query.trim().length < 2 && <p className="search-message">Shkruaj të paktën dy shkronja.</p>}
          </div>
        )}

        <CommunityStrip stats={communityStats} loadStatus={loadStatus} />

        {destination ? (
          <section className="smart-planner">
            <header><span><small>Destinacioni</small><strong>{destination.name}</strong></span><div className="planner-header-actions"><button onClick={onFilters} aria-label="Hap filtrat">☰</button><button onClick={onClearDestination} aria-label="Pastro destinacionin">×</button></div></header>
            <div className="planner-options">
              <label><span>Ecje</span><select value={walkingMinutes} onChange={(event) => onWalkingMinutes(Number(event.target.value) as 5 | 10 | 15)} aria-label="Koha maksimale e ecjes"><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
              <label><span>Rendit</span><select value={preference} onChange={(event) => onPreference(event.target.value as ParkingPreference)} aria-label="Mënyra e renditjes">{preferenceLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </section>
        ) : (
          <div className="home-secondary-actions" aria-label="Veprime të hartës">
            <button className={`chip ${activeFilterCount ? 'chip--active' : ''}`} onClick={onFilters}>☰ Filtra{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
            <button className="chip chip--map-pick" onClick={onStartMapPick}>⌖ Zgjidh në hartë</button>
          </div>
        )}
      </div>

      <button
        className={`locate-button locate-button--${locationStatus}`}
        onClick={onRecenter}
        aria-label={locationStatus === 'locating' ? 'Duke gjetur lokacionin' : locationStatus === 'denied' ? 'Leja e lokacionit është refuzuar' : locationStatus === 'unavailable' ? 'GPS nuk është i disponueshëm' : 'Përdor lokacionin tim'}
        title={locationStatus === 'denied' ? 'Leja e lokacionit është refuzuar' : locationStatus === 'unavailable' ? 'GPS nuk u gjet; po përdoret pika fillestare' : 'Përdor GPS-in'}
      >{locationStatus === 'locating' ? '…' : locationStatus === 'ready' ? '●' : '➤'}</button>
      <a
        className="street-view-fab"
        href={streetViewHref}
        target="_blank"
        rel="noreferrer"
        aria-label={`Hap Street View për ${selected.name}`}
        title="Hap panoramën më të afërt në Google Street View"
      >
        <b>360°</b><span>Street View</span>
      </a>

      <section className={`home-sheet ${destination ? 'home-sheet--smart' : ''} home-sheet--${sheetState}`}>
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
            <h1>{destination ? `Parking për ${destination.name}` : 'Parkingjet afër teje'}</h1>
            <button onClick={destination ? onToggleShowAll : onFilters}>{destination ? (showAllResults ? 'Top 3' : `Të gjitha (${rankedParkings.length})`) : `Shiko ${totalCount}`}</button>
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
              <ParkingCard parking={selected} smartMatch={selectedMatch} onOpen={onDetails} />
              <ParkingReportPanel parking={selected} report={selectedReport} compact onReport={onReport} streetViewHref={streetViewHref} />
            </>
          ) : sheetState === 'medium' ? (
            <div className="empty-state">
              <strong>Nuk gjetëm parking në këtë zonë</strong>
              <span>Provo 10 ose 15 minuta ecje.</span>
            </div>
          ) : null}
          {sheetState === 'expanded' && (
            <div className="parking-list" aria-label="Lista e parkingjeve">
              {sheetParkings.length ? sheetParkings.map((parking) => (
                <ParkingCard
                  key={parking.id}
                  parking={parking}
                  smartMatch={rankedParkings.find((match) => match.parking.id === parking.id)}
                  onOpen={() => { onSelect(parking); onDetails() }}
                />
              )) : <div className="empty-state"><strong>Nuk gjetëm parking</strong><span>Zgjero distancën e ecjes ose pastro filtrat.</span></div>}
              {!destination && mapParkings.length > sheetParkings.length && <p className="list-limit-note">Po shfaqen 30 parkingjet e para. Përdor filtrat për një listë më të shkurtër.</p>}
            </div>
          )}
        </div>
      </section>

      <BottomNav onSaved={onSaved} onTimer={onTimer} />
    </div>
  )
}

function SavedView({ parkings, onHome, onOpen, onTimer }: { parkings: Parking[]; onHome: () => void; onOpen: (parking: Parking) => void; onTimer: () => void }) {
  return (
    <div className="screen saved-screen">
      <StatusBar />
      <header className="saved-header"><div><small>Parko</small><h1>Parkingjet e ruajtura</h1></div><span>{parkings.length}</span></header>
      <main className="saved-list">
        {parkings.length ? parkings.map((parking) => (
          <ParkingCard key={parking.id} parking={parking} onOpen={() => onOpen(parking)} />
        )) : <div className="empty-state"><strong>Nuk ke parkingje të ruajtura</strong><span>Prek ＋ te detajet e një parkingu për ta ruajtur.</span></div>}
      </main>
      <BottomNav active="saved" onHome={onHome} onSaved={() => undefined} onTimer={onTimer} />
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button className="toggle-row" onClick={onChange} aria-pressed={checked}>
      <span>{label}</span>
      <span className={`toggle ${checked ? 'toggle--on' : ''}`}><i /></span>
    </button>
  )
}

function FiltersView({ filters, count, hasLiveAvailability, onChange, onApply, onClose }: {
  filters: Filters
  count: number
  hasLiveAvailability: boolean
  onChange: (filters: Filters) => void
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[]} selected={defaultParking} onSelect={() => undefined} mode="filters" />
      <button className="map-scrim" onClick={onClose} aria-label="Mbyll filtrat" />
      <section className="filter-sheet">
        <div className="drag-handle" />
        <header className="filter-sheet__header">
          <h1>Filtro parkingjet</h1>
          <button className="close-button" onClick={onClose} aria-label="Mbyll filtrat">×</button>
        </header>

        <fieldset>
          <legend>Disponueshmëria</legend>
          <div className="segmented-control">
            <button disabled={!hasLiveAvailability} className={filters.availableOnly ? 'selected' : ''} aria-pressed={filters.availableOnly} onClick={() => onChange({ ...filters, availableOnly: true })}>Të lira tani</button>
            <button className={!filters.availableOnly ? 'selected' : ''} aria-pressed={!filters.availableOnly} onClick={() => onChange({ ...filters, availableOnly: false })}>Të gjitha</button>
            <button className={filters.verifiedOnly ? 'selected' : ''} aria-pressed={filters.verifiedOnly} onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}>Me të dhëna</button>
          </div>
          {!hasLiveAvailability && <p className="filter-helper">Disponueshmëria live nuk ofrohet nga burimi aktual.</p>}
        </fieldset>

        <fieldset>
          <div className="field-label-row">
            <legend>Çmimi maksimal</legend>
            <strong>{filters.maxPrice.toFixed(2)} €/h</strong>
          </div>
          <input
            className="price-range"
            type="range"
            min="0"
            max="2"
            step="0.25"
            value={filters.maxPrice}
            onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value) })}
            aria-label="Çmimi maksimal për orë"
          />
        </fieldset>

        <fieldset>
          <legend>Lloji i parkingut</legend>
          <div className="type-pills">
            {(['public', 'private', 'street', 'municipal'] as const).map((type) => (
              <button
                key={type}
                className={filters.type === type ? 'selected' : ''}
                aria-pressed={filters.type === type}
                onClick={() => onChange({ ...filters, type: filters.type === type ? 'all' : type })}
              >
                {{ public: 'Publik', private: 'Privat', street: 'Në rrugë', municipal: 'Prishtina Parking' }[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="toggle-list">
          <Toggle label="Parking falas" checked={filters.freeOnly} onChange={() => onChange({ ...filters, freeOnly: !filters.freeOnly })} />
          <Toggle label="Mbushës për vetura elektrike" checked={filters.evCharging} onChange={() => onChange({ ...filters, evCharging: !filters.evCharging })} />
          <Toggle label="Qasje për persona me aftësi të kufizuara" checked={filters.accessible} onChange={() => onChange({ ...filters, accessible: !filters.accessible })} />
        </div>

        <button className="button button--wide" onClick={onApply}>Shfaq {count} rezultate</button>
        <button className="text-button" onClick={() => onChange(initialFilters)}>Pastro filtrat</button>
      </section>
    </div>
  )
}

function DetailsView({ parking, report, onReport, route, destination, smartMatch, streetViewHref, saved, userLocation, onToggleSaved, onBack, onNavigate }: { parking: Parking; report?: ParkingReport; onReport: (parkingId: string, patch: ParkingReportPatch) => void; route: DrivingRoute | null; destination: Destination | null; smartMatch?: RankedParking; streetViewHref: string; saved: boolean; userLocation: Parking['coordinates']; onToggleSaved: () => void; onBack: () => void; onNavigate: () => void }) {
  const routeMinutes = route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : parking.driveMinutes
  const routeDistance = route?.distanceMeters ?? parking.distanceMeters
  const categoryLabel = municipalCategoryLabel(parking)
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[parking]} selected={parking} onSelect={() => undefined} mode="details" route={route} destination={destination} userLocation={userLocation} />
      <button className="floating-back" onClick={onBack} aria-label="Kthehu">‹</button>
      <button className={`floating-add ${saved ? 'floating-add--saved' : ''}`} onClick={onToggleSaved} aria-label={saved ? 'Hiqe parkingun nga të ruajturat' : 'Ruaje parkingun'}>{saved ? '✓' : '＋'}</button>

      <section className="details-sheet">
        <div className="drag-handle" />
        <h1>{parking.name}</h1>
        <span className={`availability-badge availability-badge--${parking.status}`}>● {availabilityLabel(parking)}</span>
        <DataTrustBadge parking={parking} detailed />
        <p className="muted-copy">{accessLabel(parking)} • {parking.availabilitySource ? `Disponueshmëri nga ${parking.availabilitySource}` : 'Të dhëna të hartës OpenStreetMap'}</p>
        <ParkingReportPanel parking={parking} report={report} onReport={onReport} streetViewHref={streetViewHref} />

        <div className="stat-grid">
          <div><span>Largësia</span><strong>{routeDistance >= 1000 ? `${(routeDistance / 1000).toFixed(1)} km` : `${routeDistance} m`}</strong></div>
          <div><span>Koha</span><strong>{routeMinutes} min</strong></div>
          <div><span>Çmimi</span><strong>{priceLabel(parking)}</strong></div>
        </div>

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
            <a href={PRISHTINA_PARKING_RULES_URL} target="_blank" rel="noreferrer">Shiko rregullat zyrtare</a>
          </section>
        ) : (
          <p className="unverified-parking-note"><strong>Jo e konfirmuar si Prishtina Parking.</strong> {parking.pricingSource === 'osm-sign' ? 'Tarifa e shfaqur vjen nga OpenStreetMap; zona zyrtare dhe orari nuk dihen.' : 'Çmimi, zona zyrtare dhe orari nuk plotësohen pa burim të verifikueshëm.'}</p>
        )}
        {destination && smartMatch && <p className="walk-after-parking">Pastaj <strong>{smartMatch.walkMinutes} min ecje</strong> deri te {destination.name}</p>}

        <div className="details-actions">
          <button className="button" onClick={onNavigate}>Nisu drejt parkingut</button>
          <a className="button button--soft street-view-action" href={streetViewHref} target="_blank" rel="noreferrer" aria-label={`Hap Street View për ${parking.name}`}>360°</a>
        </div>
        {parking.osmUrl
          ? <a className="text-button report-link" href={parking.osmUrl} target="_blank" rel="noreferrer">Kontrollo ose korrigjo në OpenStreetMap</a>
          : <span className="text-button report-link report-link--disabled">Burimi nuk ka faqe raportimi</span>}
      </section>
    </div>
  )
}

function NavigationView({ parking, route, userLocation, onStop, onArrive }: { parking: Parking; route: DrivingRoute | null; userLocation: Parking['coordinates']; onStop: () => void; onArrive: () => void }) {
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
      <LiveParkingMap parkings={[]} selected={parking} onSelect={() => undefined} mode="navigation" route={route} userLocation={userLocation} />

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

      <span className="preview-badge">PARAPAMJE</span>
      <section className="arrival-card">
        <div><small>Mbërritja</small><strong>{arrivalTime}</strong></div>
        <b>{routeMinutes} min • {routeDistance >= 1000 ? `${(routeDistance / 1000).toFixed(1)} km` : `${routeDistance} m`}</b>
        <span className="confidence-badge">● {parking.spaces !== null ? `${parking.spaces} vende të lira` : accessLabel(parking)}</span>
        <button className="stop-button" onClick={(event) => { event.stopPropagation(); onStop() }}><i />Ndalo</button>
        <button className="arrival-hint" onClick={(event) => { event.stopPropagation(); onArrive() }}>Parkova • vazhdo në këmbë</button>
      </section>
    </div>
  )
}

function WalkingView({ parking, destination, route, match, directionsHref, userLocation, onFinish }: { parking: Parking; destination: Destination; route: DrivingRoute; match: RankedParking; directionsHref: string; userLocation: Parking['coordinates']; onFinish: () => void }) {
  const routeMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60))
  const isRealRoute = route.source === 'valhalla'
  return (
    <div className="screen screen--map">
      <StatusBar />
      <LiveParkingMap parkings={[parking]} selected={parking} onSelect={() => undefined} mode="walking" route={route} destination={destination} userLocation={userLocation} />

      <section className="direction-card direction-card--walking">
        <span className="turn-icon">↑</span>
        <div><small>{isRealRoute ? 'Rutë këmbësorësh' : 'Distancë e përafërt'}</small><strong>Drejt {destination.name}</strong><span>{isRealRoute ? 'Rrugë e llogaritur nga Valhalla' : 'Hap alternativën në Google Maps'}</span></div>
        <a href={directionsHref} target="_blank" rel="noreferrer" aria-label="Hap udhëzimet e ecjes">↗</a>
      </section>

      <section className="walking-arrival-card">
        <div><small>MBËRRITJA NË KËMBË</small><strong>{routeMinutes || match.walkMinutes} min</strong><span>{route.distanceMeters || match.walkDistanceMeters} m deri te destinacioni</span></div>
        <button onClick={onFinish}>Përfundo</button>
      </section>
    </div>
  )
}

function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function ParkedView({ parking, parkedAt, directionsHref, onFinish }: { parking: Parking; parkedAt: Parking['coordinates']; directionsHref: string; onFinish: () => void }) {
  const [session, setSession] = useState<ParkedSession>(() => {
    const existing = loadParkedSession()
    if (existing?.parkingId === parking.id) return existing
    const now = Date.now()
    return { parkingId: parking.id, parkedAt, startedAt: now, endsAt: now + 120 * 60_000, note: '', reminderEnabled: false }
  })
  const [now, setNow] = useState(Date.now())
  const [reminderStatus, setReminderStatus] = useState<'idle' | 'active' | 'denied' | 'unsupported'>(session.reminderEnabled ? 'active' : 'idle')
  const seconds = Math.max(0, Math.ceil((session.endsAt - now) / 1000))
  const totalSeconds = Math.max(1, Math.ceil((session.endsAt - session.startedAt) / 1000))
  const elapsedHours = Math.max(0, now - session.startedAt) / 3_600_000
  const currentCost = parking.pricePerHour === null ? null : elapsedHours * parking.pricePerHour
  const walkMinutes = Math.max(1, Math.ceil(parking.distanceMeters * 1.2 / 78))
  const carDirectionsHref = session.parkedAt ? findCarDirectionsUrl(parking, session.parkedAt) : directionsHref

  useEffect(() => {
    saveParkedSession(session)
    if (session.reminderEnabled) void scheduleParkingReminder(session.endsAt, parking.name)
  }, [parking.name, session])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function enableReminder() {
    const permission = await requestReminderPermission()
    if (permission === 'granted') {
      const next = { ...session, reminderEnabled: true }
      setSession(next)
      setReminderStatus('active')
      await scheduleParkingReminder(next.endsAt, parking.name)
      captureEvent('parking_reminder_enabled')
    } else if (permission === 'denied') setReminderStatus('denied')
    else if (permission === 'unsupported') setReminderStatus('unsupported')
    else setReminderStatus('idle')
  }

  function finish() {
    clearParkedSession()
    captureEvent('parking_session_finished')
    onFinish()
  }

  return (
    <div className="screen screen--parked">
      <header className="parked-header">
        <StatusBar light />
        <div className="parked-title"><button onClick={onFinish} aria-label="Kthehu">‹</button><strong>Vetura ime</strong></div>
        <span className="timer-label">Koha e mbetur</span>
        <div className="timer-ring" style={{ '--progress': `${Math.min(100, (seconds / totalSeconds) * 100)}%` } as React.CSSProperties}>
          <div><strong>{formatTimer(seconds)}</strong><span>orë të mbetura</span></div>
        </div>
      </header>

      <main className="parked-content">
        <section className="parking-summary">
          <strong>{parking.name}</strong>
          <span>{parking.zone} • {parking.address}</span>
          <hr />
          <div><span>Kosto e vlerësuar</span><b>{currentCost === null ? 'Pa të dhëna' : `${currentCost.toFixed(2)} €`}</b></div>
        </section>

        <button className={`reminder-button reminder-button--${reminderStatus}`} onClick={enableReminder} disabled={reminderStatus === 'active'}>
          <span>🔔</span><strong>{reminderStatus === 'active' ? 'Rikujtimi është aktiv' : reminderStatus === 'denied' ? 'Njoftimet janë bllokuar' : reminderStatus === 'unsupported' ? 'Njoftimet nuk mbështeten' : 'Aktivizo rikujtimin'}</strong>
        </button>

        <section className="return-card">
          <div><strong>Kthehu te vetura</strong><span>{walkMinutes} min ecje • {parking.distanceMeters >= 1000 ? `${(parking.distanceMeters / 1000).toFixed(1)} km` : `${parking.distanceMeters} m`} larg</span></div>
          <a href={carDirectionsHref} target="_blank" rel="noreferrer">Udhëzo</a>
        </section>

        <button className="button button--wide" onClick={finish}>Përfundo parkimin</button>
        <small className="reminder-copy">Timeri ruhet në këtë pajisje.</small>
      </main>
    </div>
  )
}

export default function App() {
  const persistedPreferences = useRef(loadPreferences()).current
  const [screen, setScreen] = useState<Screen>('home')
  const [selected, setSelected] = useState(() => getPrishtinaParkingSnapshot().find((parking) => parking.id === persistedPreferences.selectedParkingId) ?? defaultParking)
  const [filters, setFilters] = useState<Filters>(() => ({ ...initialFilters, ...persistedPreferences.filters }))
  const [draftFilters, setDraftFilters] = useState<Filters>(() => ({ ...initialFilters, ...persistedPreferences.filters }))
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
  const [walkingMinutes, setWalkingMinutes] = useState<5 | 10 | 15>(10)
  const [preference, setPreference] = useState<ParkingPreference>('best')
  const [showAllResults, setShowAllResults] = useState(true)
  const [drivingMatrix, setDrivingMatrix] = useState<DrivingMatrixEntry[]>([])
  const [pickingDestination, setPickingDestination] = useState(false)
  const [recenterToken, setRecenterToken] = useState(0)
  const [savedParkingIds, setSavedParkingIds] = useState<Set<string>>(() => new Set(persistedPreferences.savedParkingIds ?? []))
  const [parkingReports, setParkingReports] = useState<Record<string, ParkingReport>>(loadParkingReports)
  const [userLocation, setUserLocation] = useState(USER_LOCATION)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'ready' | 'denied' | 'unavailable'>('idle')
  const parkingSelectedByUserRef = useRef(false)
  const parkingDetailsAttemptedRef = useRef(new Set<string>())

  useEffect(() => {
    const controller = new AbortController()
    setRoute(null)
    const entrance = parkingAccessPoint(selected, userLocation)
    loadDrivingRoute(userLocation, entrance, controller.signal)
      .then(setRoute)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRoute(null)
          captureEvent('driving_route_failed')
        }
      })
    return () => controller.abort()
  }, [selected, userLocation])

  useEffect(() => {
    savePreferences({ filters, savedParkingIds: [...savedParkingIds], selectedParkingId: selected.id })
  }, [filters, savedParkingIds, selected.id])

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

  useEffect(() => {
    if (locationStatus !== 'ready' || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [locationStatus])

  const reportedParkings = useMemo(() => parkings.map((parking) => applyParkingReport(parking, parkingReports[parking.id])), [parkings, parkingReports])
  const locatedParkings = useMemo(() => reportedParkings.map((parking) => ({
    ...parking,
    distanceMeters: distanceMeters(userLocation, parking.coordinates),
  })), [reportedParkings, userLocation])
  const currentSelected = locatedParkings.find((parking) => parking.id === selected.id) ?? selected
  const hasLiveAvailability = useMemo(() => locatedParkings.some((parking) => parking.spaces !== null && parking.availabilitySource), [locatedParkings])
  const effectiveFilters = useMemo(() => filtersForAvailability(filters, hasLiveAvailability), [filters, hasLiveAvailability])
  const effectiveDraftFilters = useMemo(() => filtersForAvailability(draftFilters, hasLiveAvailability), [draftFilters, hasLiveAvailability])
  const filteredParkings = useMemo(() => locatedParkings
    .filter((parking) => matchesFilters(parking, effectiveFilters))
    .sort((first, second) => first.distanceMeters - second.distanceMeters), [effectiveFilters, locatedParkings])
  const draftFilteredCount = useMemo(() => locatedParkings.filter((parking) => matchesFilters(parking, effectiveDraftFilters)).length, [effectiveDraftFilters, locatedParkings])

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
  const candidateKey = candidates.map(({ parking }) => parking.id).join('|')

  useEffect(() => {
    if (!destination || !candidates.length) {
      setDrivingMatrix([])
      return
    }
    const controller = new AbortController()
    setDrivingMatrix([])
    loadDrivingMatrix(userLocation, candidates.map(({ parking }) => parking), controller.signal)
      .then(setDrivingMatrix)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setDrivingMatrix([])
      })
    return () => controller.abort()
  }, [candidateKey, destination, userLocation])

  const rankedParkings = useMemo(
    () => rankParkings(candidates, drivingMatrix, preference),
    [candidates, drivingMatrix, preference],
  )
  const mapRankedParkings = showAllResults ? rankedParkings : rankedParkings.slice(0, 3)
  const mapParkings = destination ? mapRankedParkings.map(({ parking }) => parking) : filteredParkings
  const selectedRankedParking = rankedParkings.find((match) => match.parking.id === currentSelected.id)
  const communityStats = useMemo<CommunityStats>(() => {
    const reports = Object.values(parkingReports)
    return {
      reports: reports.length,
      freeSignals: reports.filter((report) => report.availability === 'free-spots').length,
      policeSignals: reports.filter((report) => report.policeRisk === true).length,
      municipalParkings: locatedParkings.filter((parking) => parking.municipalManaged).length,
    }
  }, [parkingReports, locatedParkings])
  const selectedStreetViewHref = useMemo(() => streetViewUrl(currentSelected, route), [currentSelected, route])
  const findCarHref = useMemo(() => findCarDirectionsUrl(currentSelected), [currentSelected])
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
    setSearchOpen(true)
    setSearchError('')
    if (!online) {
      setSearchError('Je offline. Përdor sugjerimet lokale ose zgjidh një pikë në hartë.')
      return
    }
    setSearchingOnline(true)
    try {
      const results = await searchDestinationOnline(query)
      setOnlineSearchResults(results)
      if (!results.length) setSearchError('Nuk u gjet asnjë rezultat online. Provo emrin e rrugës ose zonës.')
    } catch {
      setOnlineSearchResults([])
      setSearchError('Kërkimi online dështoi. Provo përsëri.')
    } finally {
      setSearchingOnline(false)
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
    parkingSelectedByUserRef.current = false
    setDestination(nextDestination)
    setQuery(nextDestination.name)
    setSearchOpen(false)
    setOnlineSearchResults([])
    setSearchError('')
    setShowAllResults(true)
    setPickingDestination(false)
    rememberDestination(nextDestination)
  }

  function clearDestination() {
    setDestination(null)
    setQuery('')
    setSearchOpen(false)
    setOnlineSearchResults([])
    setSearchError('')
    setShowAllResults(true)
    setPickingDestination(false)
  }

  function selectParking(nextParking: Parking) {
    parkingSelectedByUserRef.current = true
    setSelected(nextParking)
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
      setRecenterToken((value) => value + 1)
      return
    }
    setLocationStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationStatus('ready')
        setRecenterToken((value) => value + 1)
        captureEvent('location_ready', { accuracyBucket: position.coords.accuracy < 30 ? 'high' : position.coords.accuracy < 100 ? 'medium' : 'low' })
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        captureEvent('location_failed', { code: error.code })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }

  function openTimer() {
    const session = loadParkedSession()
    const parked = session ? locatedParkings.find((parking) => parking.id === session.parkingId) : undefined
    if (parked) setSelected(parked)
    setScreen('parked')
  }

  function openFilters() {
    setDraftFilters(filtersForAvailability(filters, hasLiveAvailability))
    setSearchOpen(false)
    setScreen('filters')
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
        {screen === 'home' && (
          <HomeView
            mapParkings={mapParkings}
            totalCount={filteredParkings.length}
            selected={currentSelected}
            filters={filters}
            hasLiveAvailability={hasLiveAvailability}
            query={query}
            onQuery={(value) => { setQuery(value); setSearchOpen(true); setOnlineSearchResults([]); setSearchError('') }}
            searchResults={searchResults}
            recentDestinations={recentDestinations}
            searchOpen={searchOpen}
            searchingOnline={searchingOnline}
            searchError={searchError}
            online={online}
            destination={destination}
            walkingMinutes={walkingMinutes}
            preference={preference}
            rankedParkings={rankedParkings}
            showAllResults={showAllResults}
            pickingDestination={pickingDestination}
            onSelect={selectParking}
            onSelectDestination={selectDestination}
            onClearRecent={() => { setRecentDestinations([]); try { localStorage.removeItem(RECENT_DESTINATIONS_KEY) } catch { /* storage can be unavailable */ } }}
            onSearchFocus={() => setSearchOpen(true)}
            onSearchOnline={runOnlineSearch}
            onCloseSearch={() => setSearchOpen(false)}
            onClearDestination={clearDestination}
            onWalkingMinutes={setWalkingMinutes}
            onPreference={setPreference}
            onToggleShowAll={() => setShowAllResults((value) => !value)}
            onStartMapPick={() => { setSearchOpen(false); setPickingDestination(true); setDestination(null) }}
            onPickDestination={pickDestinationOnMap}
            communityStats={communityStats}
            selectedReport={parkingReports[currentSelected.id]}
            onReport={reportParking}
            streetViewHref={selectedStreetViewHref}
            recenterToken={recenterToken}
            onRecenter={requestUserLocation}
            locationStatus={locationStatus}
            userLocation={userLocation}
            onFilters={openFilters}
            onDetails={() => setScreen('details')}
            onSaved={() => setScreen('saved')}
            onTimer={openTimer}
            loadStatus={loadStatus}
          />
        )}
        {screen === 'saved' && <SavedView parkings={locatedParkings.filter((parking) => savedParkingIds.has(parking.id))} onHome={() => setScreen('home')} onOpen={(parking) => { setSelected(parking); setDestination(null); setScreen('details') }} onTimer={openTimer} />}
        {screen === 'filters' && (
          <FiltersView filters={effectiveDraftFilters} count={draftFilteredCount} hasLiveAvailability={hasLiveAvailability} onChange={setDraftFilters} onApply={() => { setFilters(effectiveDraftFilters); setScreen('home') }} onClose={() => setScreen('home')} />
        )}
        {screen === 'details' && <DetailsView parking={currentSelected} report={parkingReports[currentSelected.id]} onReport={reportParking} route={route} destination={destination} smartMatch={selectedRankedParking} streetViewHref={selectedStreetViewHref} saved={savedParkingIds.has(currentSelected.id)} userLocation={userLocation} onToggleSaved={toggleSavedParking} onBack={() => setScreen('home')} onNavigate={() => setScreen('navigation')} />}
        {screen === 'navigation' && <NavigationView parking={currentSelected} route={route} userLocation={userLocation} onStop={() => setScreen('details')} onArrive={() => setScreen(destination ? 'walking' : 'parked')} />}
        {screen === 'walking' && destination && displayedWalkingRoute && selectedRankedParking && <WalkingView parking={currentSelected} destination={destination} route={displayedWalkingRoute} match={selectedRankedParking} directionsHref={selectedWalkingDirectionsHref} userLocation={userLocation} onFinish={() => setScreen('parked')} />}
        {screen === 'parked' && <ParkedView parking={currentSelected} parkedAt={locationStatus === 'ready' ? userLocation : currentSelected.coordinates} directionsHref={findCarHref} onFinish={() => setScreen('home')} />}
      </div>
      <p className="desktop-caption">Parko • prototip interaktiv për Prishtinën</p>
    </div>
  )
}
