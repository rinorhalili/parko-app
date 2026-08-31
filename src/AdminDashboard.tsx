import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'

type ParkingCategory = 'public' | 'street' | 'prishtina' | 'private'
type NavKey = 'queue' | 'map' | 'reports' | 'users'
type RiskLevel = 'low' | 'medium' | 'high'

type SpotSubmission = {
  id: string
  anonymousId: string
  submittedAt: string
  city: string
  address: string
  category: ParkingCategory
  proposedPrice: number
  lat: number
  lng: number
  notes: string
  riskLevel: RiskLevel
  communityVotes: number
  duplicateSignals: number
}

const sidebarItems: Array<{ key: NavKey; label: string; count: number }> = [
  { key: 'queue', label: 'Miratime', count: 24 },
  { key: 'map', label: 'Harta live', count: 318 },
  { key: 'reports', label: 'Raporte rreziku', count: 12 },
  { key: 'users', label: 'Përdorues anonim', count: 1845 },
]

const cityOptions = ['Të gjitha qytetet', 'Prishtina', 'Prizren', 'Peja', 'Ferizaj', 'Gjakova', 'Mitrovica']
const rejectionReasons = [
  'Lokacion i dyfishuar',
  'Nuk verifikohet në hartë',
  'Çmimi nuk duket realist',
  'Qasje private pa leje',
  'Rrugë e rrezikshme',
]

const categoryMeta: Record<ParkingCategory, { label: string; short: string; color: string; soft: string }> = {
  public: { label: 'Publik', short: 'PUB', color: '#16a66c', soft: '#e8f7f0' },
  street: { label: 'Në rrugë', short: 'RR', color: '#f59e0b', soft: '#fff5df' },
  prishtina: { label: 'Prishtina Parking', short: 'PP', color: '#246bfd', soft: '#eef4ff' },
  private: { label: 'Privat', short: 'PRI', color: '#7c3aed', soft: '#f2edff' },
}

const submissions: SpotSubmission[] = [
  {
    id: 'PK-2412',
    anonymousId: 'Anonim 1432',
    submittedAt: 'Sot • 09:34',
    city: 'Prishtina',
    address: 'Rr. Ibrahim Rugova 42',
    category: 'prishtina',
    proposedPrice: 1.5,
    lat: 42.6629,
    lng: 21.1655,
    notes: 'Dy vende afër parkingut komunal. Rampa shihet te hyrja; duhet verifikuar orari pas 18:00.',
    riskLevel: 'medium',
    communityVotes: 17,
    duplicateSignals: 1,
  },
  {
    id: 'PK-2413',
    anonymousId: 'Anonim 1488',
    submittedAt: 'Sot • 08:47',
    city: 'Prizren',
    address: 'Bulevardi Nënë Tereza 14',
    category: 'private',
    proposedPrice: 0,
    lat: 42.2139,
    lng: 20.7368,
    notes: 'Hapësirë private pas hyrjes së hotelit. Duket aktive gjatë ditës, por kërkon kontroll të lejes.',
    riskLevel: 'low',
    communityVotes: 9,
    duplicateSignals: 0,
  },
  {
    id: 'PK-2414',
    anonymousId: 'Anonim 1501',
    submittedAt: 'Dje • 17:11',
    city: 'Peja',
    address: 'Sheshi Qendror, afër tregut',
    category: 'public',
    proposedPrice: 0,
    lat: 42.6596,
    lng: 20.2889,
    notes: 'Hapësirë publike buzë trotuarit. Rruga është e ngushtë, por sinjalistika nuk ndalon parkimin.',
    riskLevel: 'low',
    communityVotes: 21,
    duplicateSignals: 0,
  },
  {
    id: 'PK-2415',
    anonymousId: 'Anonim 1516',
    submittedAt: 'Dje • 13:52',
    city: 'Ferizaj',
    address: 'Rr. Agim Ramadani 7',
    category: 'street',
    proposedPrice: 2,
    lat: 42.375,
    lng: 21.1504,
    notes: 'Korsi e ngushtë pranë stacionit të autobusit. Duhet shënuar si zonë me rrezik gjobe.',
    riskLevel: 'high',
    communityVotes: 6,
    duplicateSignals: 2,
  },
  {
    id: 'PK-2416',
    anonymousId: 'Anonim 1579',
    submittedAt: 'Hën • 11:20',
    city: 'Prishtina',
    address: 'Rr. Luan Haradinaj 16',
    category: 'public',
    proposedPrice: 1.2,
    lat: 42.6556,
    lng: 21.1637,
    notes: 'Garazh me hyrje nga rruga anësore. Çmimi është raportuar nga komuniteti, por duhet konfirmuar tabela.',
    riskLevel: 'medium',
    communityVotes: 14,
    duplicateSignals: 1,
  },
]

const styles = `
  .admin-dashboard {
    --admin-bg: #edf1f5;
    --surface: #ffffff;
    --surface-soft: #f6f8fb;
    --line: #e1e8f0;
    --primary: #246bfd;
    --primary-soft: #eef4ff;
    --success: #16a66c;
    --warning: #f59e0b;
    --danger: #df4a5b;
    --ink: #102033;
    --muted: #66758a;
    min-height: 100vh;
    width: 100%;
    padding: 18px;
    background: var(--admin-bg);
    color: var(--ink);
    font-family: Inter, 'Segoe UI', sans-serif;
  }

  .admin-dashboard * { box-sizing: border-box; }

  .admin-shell {
    max-width: 1320px;
    margin: 0 auto;
    display: grid;
    gap: 14px;
  }

  .admin-topbar {
    min-height: 72px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(255, 255, 255, .9);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(16, 32, 51, .07);
  }

  .admin-title {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .admin-title small,
  .panel-kicker,
  .queue-header small,
  .tool-card small,
  .detail-item small {
    color: var(--muted);
    font-size: 10px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .admin-title h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 0;
    line-height: 1.05;
  }

  .admin-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .admin-button,
  .admin-select,
  .nav-item,
  .queue-card {
    font: inherit;
  }

  .admin-button {
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
    color: var(--ink);
    font-size: 12px;
    font-weight: 850;
  }

  .admin-button--primary {
    border-color: var(--primary);
    background: var(--primary);
    color: #fff;
    box-shadow: 0 8px 20px rgba(36, 107, 253, .18);
  }

  .admin-button--danger {
    border-color: #ffd3da;
    background: #fff0f2;
    color: #a83243;
  }

  .admin-button--warning {
    border-color: #ffe3ad;
    background: #fff6e5;
    color: #8b5b00;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .metric-card {
    min-height: 96px;
    padding: 13px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    display: grid;
    align-content: space-between;
    gap: 10px;
  }

  .metric-card span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .metric-card i,
  .queue-dot,
  .map-marker {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--metric-color, var(--primary));
  }

  .metric-card strong {
    font-size: 27px;
    line-height: 1;
  }

  .metric-card small {
    color: var(--muted);
    font-size: 11px;
    font-weight: 750;
  }

  .admin-layout {
    display: grid;
    grid-template-columns: 290px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .admin-sidebar,
  .admin-main,
  .map-panel,
  .tools-panel {
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(255, 255, 255, .92);
    box-shadow: 0 8px 24px rgba(16, 32, 51, .06);
  }

  .admin-sidebar {
    padding: 12px;
    display: grid;
    gap: 12px;
    position: sticky;
    top: 12px;
  }

  .nav-list {
    display: grid;
    gap: 6px;
  }

  .nav-item {
    width: 100%;
    min-height: 46px;
    padding: 8px 10px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: #3a4b61;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
    font-size: 12px;
    font-weight: 850;
  }

  .nav-item.active {
    background: var(--primary-soft);
    color: #174ebd;
  }

  .nav-item span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .nav-count {
    min-width: 28px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: #f0f3f7;
    display: grid;
    place-content: center;
    color: #5f6f83;
    font-size: 10px;
  }

  .filter-panel {
    padding: 10px;
    border-radius: 14px;
    background: var(--surface-soft);
    display: grid;
    gap: 8px;
  }

  .admin-input,
  .admin-select {
    width: 100%;
    min-height: 42px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
    color: var(--ink);
    padding: 0 11px;
    outline: 0;
    font-size: 12px;
    font-weight: 750;
  }

  .queue-panel {
    display: grid;
    gap: 8px;
  }

  .queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 2px 2px 0;
  }

  .queue-header h2,
  .section-title {
    margin: 0;
    font-size: 15px;
    letter-spacing: 0;
  }

  .queue-list {
    max-height: 460px;
    overflow: auto;
    display: grid;
    gap: 8px;
    padding-right: 2px;
  }

  .queue-card {
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
    color: var(--ink);
    display: grid;
    gap: 8px;
    text-align: left;
  }

  .queue-card.active {
    border-color: #a7c0ff;
    background: #f7faff;
    box-shadow: inset 0 0 0 1px rgba(36, 107, 253, .1);
  }

  .queue-card__top,
  .detail-title,
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .queue-card__identity {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .queue-avatar {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 11px;
    background: #eef4ff;
    color: #174ebd;
    display: grid;
    place-content: center;
    font-size: 11px;
    font-weight: 900;
  }

  .queue-card b {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .queue-card small,
  .queue-card__meta {
    color: var(--muted);
    font-size: 10px;
    font-weight: 750;
  }

  .queue-card__meta {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
  }

  .chip {
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .04em;
    white-space: nowrap;
  }

  .chip.low { background: #e8f7f0; color: #10764d; }
  .chip.medium { background: #fff5df; color: #8b5b00; }
  .chip.high { background: #fff0f2; color: #a83243; }

  .admin-main {
    overflow: hidden;
  }

  .main-grid {
    display: grid;
    grid-template-columns: minmax(0, .98fr) minmax(0, 1.02fr);
    min-height: 640px;
  }

  .review-panel,
  .verification-panel {
    min-width: 0;
    padding: 16px;
    display: grid;
    align-content: start;
    gap: 14px;
  }

  .review-panel {
    border-right: 1px solid var(--line);
  }

  .panel-kicker {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .detail-title h2 {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 22px;
    line-height: 1.12;
    letter-spacing: 0;
  }

  .price-tag {
    flex: 0 0 auto;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    background: #e8f7f0;
    color: #10764d;
    display: grid;
    place-content: center;
    font-size: 11px;
    font-weight: 900;
  }

  .detail-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }

  .category-pill {
    --pill-color: #246bfd;
    --pill-soft: #eef4ff;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--pill-soft);
    color: var(--pill-color);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 900;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .detail-item,
  .notes-panel,
  .tool-card {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface-soft);
    padding: 12px;
  }

  .detail-item {
    display: grid;
    gap: 6px;
  }

  .detail-item strong {
    overflow-wrap: anywhere;
    font-size: 14px;
  }

  .notes-panel {
    display: grid;
    gap: 8px;
  }

  .notes-panel h3,
  .map-panel h3,
  .tools-panel h3 {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .notes-panel p {
    margin: 0;
    color: #26384e;
    font-size: 13px;
    line-height: 1.55;
  }

  .map-panel {
    overflow: hidden;
  }

  .map-panel .panel-header,
  .tools-panel .panel-header {
    min-height: 50px;
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }

  .community-map {
    height: 298px;
    background: #dfe8ef;
  }

  .community-map .leaflet-control-attribution {
    max-width: 145px;
    font-size: 8px;
    opacity: .72;
  }

  .map-marker {
    width: 28px;
    height: 28px;
    border: 3px solid #fff;
    box-shadow: 0 5px 14px rgba(16, 32, 51, .25);
  }

  .map-marker--active {
    width: 34px;
    height: 34px;
    box-shadow: 0 0 0 7px rgba(36, 107, 253, .16), 0 7px 18px rgba(16, 32, 51, .3);
  }

  .map-caption {
    padding: 10px 12px 12px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 750;
  }

  .tools-panel {
    display: grid;
    overflow: hidden;
  }

  .tool-grid {
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .tool-card {
    min-height: 86px;
    display: grid;
    align-content: space-between;
    gap: 7px;
  }

  .tool-card strong {
    font-size: 13px;
  }

  .action-bar {
    padding: 14px 16px 16px;
    border-top: 1px solid var(--line);
    background: #f8fafc;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .reject-select {
    min-width: 210px;
    flex: 1;
  }

  @media (max-width: 1040px) {
    .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .admin-layout { grid-template-columns: 1fr; }
    .admin-sidebar { position: static; }
    .nav-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .queue-list { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: none; }
  }

  @media (max-width: 780px) {
    .admin-dashboard { padding: 10px; }
    .admin-topbar { align-items: flex-start; flex-direction: column; border-radius: 16px; }
    .admin-actions { width: 100%; justify-content: stretch; }
    .admin-actions .admin-button { flex: 1; }
    .main-grid { grid-template-columns: 1fr; min-height: 0; }
    .review-panel { border-right: 0; border-bottom: 1px solid var(--line); }
    .nav-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .queue-list { grid-template-columns: 1fr; }
    .detail-grid { grid-template-columns: 1fr; }
    .tool-grid { grid-template-columns: 1fr; }
    .community-map { height: 250px; }
  }

  @media (max-width: 440px) {
    .admin-dashboard { padding: 0; }
    .admin-shell { gap: 10px; }
    .admin-topbar,
    .admin-sidebar,
    .admin-main {
      border-left: 0;
      border-right: 0;
      border-radius: 0;
    }
    .metrics-grid { grid-template-columns: 1fr 1fr; padding: 0 8px; gap: 8px; }
    .metric-card { min-height: 84px; padding: 10px; }
    .metric-card strong { font-size: 22px; }
    .metric-card span { font-size: 8px; }
    .admin-sidebar { padding: 10px; }
    .nav-item { min-height: 42px; padding: 7px 8px; font-size: 11px; }
    .review-panel,
    .verification-panel { padding: 12px; }
    .detail-title { align-items: flex-start; flex-direction: column; }
    .detail-title h2 { font-size: 19px; }
    .action-bar { display: grid; grid-template-columns: 1fr; }
    .reject-select { min-width: 0; }
  }
`

function formatPrice(price: number) {
  return price === 0 ? 'Falas' : `${price.toFixed(2)} €/orë`
}

function categoryCount(category: ParkingCategory) {
  return submissions.filter((item) => item.category === category).length
}

function riskLabel(risk: RiskLevel) {
  return {
    low: 'Ulët',
    medium: 'Mesëm',
    high: 'Lartë',
  }[risk]
}

function MetricCard({ label, value, meta, color }: { label: string; value: string; meta: string; color: string }) {
  return (
    <article className="metric-card" style={{ '--metric-color': color } as React.CSSProperties}>
      <span>{label}<i /></span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  )
}

function CategoryPill({ category }: { category: ParkingCategory }) {
  const meta = categoryMeta[category]
  return (
    <span className="category-pill" style={{ '--pill-color': meta.color, '--pill-soft': meta.soft } as React.CSSProperties}>
      <i className="queue-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function SidebarNavItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span><span className="queue-dot" />{label}</span>
      <span className="nav-count">{count}</span>
    </button>
  )
}

function SubmissionCard({ submission, active, onSelect }: { submission: SpotSubmission; active: boolean; onSelect: () => void }) {
  const meta = categoryMeta[submission.category]
  return (
    <button type="button" className={`queue-card ${active ? 'active' : ''}`} onClick={onSelect}>
      <span className="queue-card__top">
        <span className="queue-card__identity">
          <span className="queue-avatar">{meta.short}</span>
          <span>
            <b>{submission.anonymousId}</b>
            <small>{submission.submittedAt}</small>
          </span>
        </span>
        <span className={`chip ${submission.riskLevel}`}>{riskLabel(submission.riskLevel)}</span>
      </span>
      <span className="queue-card__meta">
        <span>{meta.label}</span>
        <strong>{formatPrice(submission.proposedPrice)}</strong>
        <span>{submission.city}</span>
        <span>{submission.id}</span>
      </span>
    </button>
  )
}

function CommunityMapPreview({ items, selectedId, onSelect }: { items: SpotSubmission[]; selectedId: string; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [42.6629, 21.1655],
      zoom: 13,
      minZoom: 8,
      zoomControl: false,
      attributionControl: false,
    })
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'Harta: OpenStreetMap',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const bounds: L.LatLngTuple[] = []
    items.forEach((item) => {
      const meta = categoryMeta[item.category]
      const active = item.id === selectedId
      const icon = L.divIcon({
        className: '',
        html: `<span class="map-marker${active ? ' map-marker--active' : ''}" style="background:${meta.color}"></span>`,
        iconSize: active ? [34, 34] : [28, 28],
        iconAnchor: active ? [17, 17] : [14, 14],
      })
      const marker = L.marker([item.lat, item.lng], { icon, title: `${item.id} · ${meta.label}` })
      marker.on('click', () => onSelectRef.current(item.id))
      marker.bindTooltip(`${item.id} · ${meta.label}`, { direction: 'top' })
      marker.addTo(layer)
      bounds.push([item.lat, item.lng])
    })
    if (bounds.length === 1) map.setView(bounds[0], 15, { animate: false })
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false })
  }, [items, selectedId])

  return <div ref={containerRef} className="community-map" aria-label="Harta e komunitetit me parkingje të raportuara" />
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<NavKey>('queue')
  const [searchTerm, setSearchTerm] = useState('')
  const [cityFilter, setCityFilter] = useState(cityOptions[0])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rejectReason, setRejectReason] = useState(rejectionReasons[0])

  const filteredSubmissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return submissions.filter((item) => {
      const cityMatches = cityFilter === cityOptions[0] || item.city === cityFilter
      const textMatches =
        term.length === 0 ||
        item.address.toLowerCase().includes(term) ||
        item.city.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        item.anonymousId.toLowerCase().includes(term) ||
        categoryMeta[item.category].label.toLowerCase().includes(term)
      return cityMatches && textMatches
    })
  }, [cityFilter, searchTerm])

  useEffect(() => {
    if (selectedIndex > filteredSubmissions.length - 1) {
      setSelectedIndex(Math.max(filteredSubmissions.length - 1, 0))
    }
  }, [filteredSubmissions.length, selectedIndex])

  const selectedSubmission = filteredSubmissions[selectedIndex] ?? filteredSubmissions[0] ?? submissions[0]

  const selectById = (id: string) => {
    const index = filteredSubmissions.findIndex((item) => item.id === id)
    if (index >= 0) setSelectedIndex(index)
  }

  const advanceQueue = () => {
    if (!filteredSubmissions.length) return
    setSelectedIndex((current) => (current + 1) % filteredSubmissions.length)
  }

  return (
    <div className="admin-dashboard">
      <style>{styles}</style>

      <div className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-title">
            <small>Parko Community OS</small>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-actions" aria-label="Veprime të adminit">
            <button className="admin-button" type="button">Eksporto radhën</button>
            <button className="admin-button admin-button--primary" type="button">Sinkronizo live</button>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Statistikat kryesore">
          <MetricCard label="Publike" value={String(categoryCount('public'))} meta="Të hapura për komunitetin" color={categoryMeta.public.color} />
          <MetricCard label="Në rrugë" value={String(categoryCount('street'))} meta="Kërkojnë kontroll rreziku" color={categoryMeta.street.color} />
          <MetricCard label="Prishtina Parking" value={String(categoryCount('prishtina'))} meta="Zona zyrtare ose komunal" color={categoryMeta.prishtina.color} />
          <MetricCard label="Private" value={String(categoryCount('private'))} meta="Shfaqen me qasje të kufizuar" color={categoryMeta.private.color} />
        </section>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <nav className="nav-list" aria-label="Navigimi i adminit">
              {sidebarItems.map((item) => (
                <SidebarNavItem key={item.key} label={item.label} count={item.count} active={activeTab === item.key} onClick={() => setActiveTab(item.key)} />
              ))}
            </nav>

            <div className="filter-panel">
              <input
                className="admin-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Kërko lokacion ose ID"
                aria-label="Kërko raportimet"
              />
              <select className="admin-select" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} aria-label="Filtro sipas qytetit">
                {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>

            <section className="queue-panel" aria-label="Radha e raportimeve">
              <div className="queue-header">
                <h2>Radha</h2>
                <small>{filteredSubmissions.length} lokacione</small>
              </div>
              <div className="queue-list">
                {filteredSubmissions.length === 0 ? (
                  <div className="queue-card"><b>Ska rezultate</b><small>Ndrysho filtrin ose kërkimin.</small></div>
                ) : filteredSubmissions.map((submission, index) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    active={index === selectedIndex}
                    onSelect={() => setSelectedIndex(index)}
                  />
                ))}
              </div>
            </section>
          </aside>

          <main className="admin-main">
            <div className="main-grid">
              <section className="review-panel" aria-label="Detajet e raportimit">
                <span className="panel-kicker"><span className="queue-dot" />{selectedSubmission.id} · i verifikuar në mënyrë anonime</span>
                <div className="detail-title">
                  <h2>{selectedSubmission.address}</h2>
                  <span className="price-tag">{formatPrice(selectedSubmission.proposedPrice)}</span>
                </div>
                <div className="detail-meta">
                  <CategoryPill category={selectedSubmission.category} />
                  <span className={`chip ${selectedSubmission.riskLevel}`}>Rrezik {riskLabel(selectedSubmission.riskLevel)}</span>
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <small>Raportuesi</small>
                    <strong>{selectedSubmission.anonymousId}</strong>
                  </div>
                  <div className="detail-item">
                    <small>Koha</small>
                    <strong>{selectedSubmission.submittedAt}</strong>
                  </div>
                  <div className="detail-item">
                    <small>Sinjale</small>
                    <strong>{selectedSubmission.communityVotes} vota · {selectedSubmission.duplicateSignals} dubl.</strong>
                  </div>
                </div>

                <section className="notes-panel">
                  <h3>Shënim moderimi</h3>
                  <p>{selectedSubmission.notes}</p>
                </section>

                <section className="tools-panel" aria-label="Mjetet kryesore të adminit">
                  <div className="panel-header">
                    <h3>Tools për komunitet</h3>
                    <span className="chip low">Live</span>
                  </div>
                  <div className="tool-grid">
                    <article className="tool-card">
                      <strong>Moderim raportesh</strong>
                      <small>Mirato, refuzo, bashko dublimet</small>
                    </article>
                    <article className="tool-card">
                      <strong>Kontroll privatësie</strong>
                      <small>Anonimizim dhe auditim i të dhënave</small>
                    </article>
                    <article className="tool-card">
                      <strong>Rreziqe në rrugë</strong>
                      <small>Polici, merimangë, gjoba dhe bllokime</small>
                    </article>
                    <article className="tool-card">
                      <strong>Health check</strong>
                      <small>Harta, sinkronizimi, raporte offline</small>
                    </article>
                  </div>
                </section>
              </section>

              <section className="verification-panel" aria-label="Verifikimi në hartë">
                <section className="map-panel">
                  <div className="panel-header">
                    <h3>Harta Parko</h3>
                    <CategoryPill category={selectedSubmission.category} />
                  </div>
                  <CommunityMapPreview items={filteredSubmissions} selectedId={selectedSubmission.id} onSelect={selectById} />
                  <div className="map-caption">
                    Pa foto dhe pa emra publikë. Admini sheh lokacionin, kategorinë, sinjalet dhe statusin e verifikimit.
                  </div>
                </section>
              </section>
            </div>

            <div className="action-bar" aria-label="Vendimi i adminit">
              <button className="admin-button admin-button--primary" type="button" onClick={advanceQueue}>Mirato dhe publiko</button>
              <select className="admin-select reject-select" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} aria-label="Arsyeja e refuzimit">
                {rejectionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              <button className="admin-button admin-button--danger" type="button" onClick={advanceQueue}>Refuzo</button>
              <button className="admin-button admin-button--warning" type="button" onClick={advanceQueue}>Dërgo për kontroll në terren</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
