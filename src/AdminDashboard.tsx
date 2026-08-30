import { useEffect, useMemo, useState } from 'react'

type ParkingType = 'Free' | 'Paid Public' | 'Private' | 'Risky Street'
type NavKey = 'pending' | 'active' | 'flagged' | 'users'

type SpotSubmission = {
  id: string
  userName: string
  submittedAt: string
  city: string
  address: string
  parkingType: ParkingType
  proposedPrice: number
  lat: number
  lng: number
  photos: string[]
  notes: string
  riskLevel: 'low' | 'medium' | 'high'
}

const sidebarItems: Array<{ key: NavKey; label: string; count?: number }> = [
  { key: 'pending', label: 'Pending Approvals', count: 24 },
  { key: 'active', label: 'Active Spots', count: 318 },
  { key: 'flagged', label: 'Reported Flagged Spots', count: 12 },
  { key: 'users', label: 'User Management', count: 1845 },
]

const cityOptions = ['All cities', 'Prishtina', 'Prizren', 'Peja', 'Ferizaj', 'Gjakova', 'Mitrovica']
const rejectionReasons = [
  'Duplicate listing',
  'Location not verifiable',
  'Price not realistic',
  'Photo does not match site',
  'Private property without authorization',
  'Unsafe / hazardous access',
]

const submissions: SpotSubmission[] = [
  {
    id: 'PK-2412',
    userName: 'Ariana N.',
    submittedAt: 'Today • 09:34',
    city: 'Prishtina',
    address: 'Rr. Ibrahim Rugova 42',
    parkingType: 'Paid Public',
    proposedPrice: 1.5,
    lat: 42.6629,
    lng: 21.1655,
    notes: 'Two bays shared with municipal lot. Barrier at entrance is visible and can be used by residents only after 18:00.',
    riskLevel: 'medium',
    photos: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: 'PK-2413',
    userName: 'Besim H.',
    submittedAt: 'Today • 08:47',
    city: 'Prizren',
    address: 'Bulevardi Nënë Tereza 14',
    parkingType: 'Private',
    proposedPrice: 0,
    lat: 42.2139,
    lng: 20.7368,
    notes: 'Private lot behind hotel entrance with good visibility from road. Barrier gate is half-open during daytime.',
    riskLevel: 'low',
    photos: [
      'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: 'PK-2414',
    userName: 'Liridona G.',
    submittedAt: 'Yesterday • 17:11',
    city: 'Peja',
    address: 'Sheshi Qendrore, near market stairwell',
    parkingType: 'Free',
    proposedPrice: 0,
    lat: 42.6596,
    lng: 20.2889,
    notes: 'Public curb space near a pedestrian zone. Street is narrow, but there is a clear gray line and no no-parking sign.',
    riskLevel: 'low',
    photos: [
      'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: 'PK-2415',
    userName: 'Endrit B.',
    submittedAt: 'Yesterday • 13:52',
    city: 'Ferizaj',
    address: 'Rr. Agim Ramadani 7, behind clinic',
    parkingType: 'Risky Street',
    proposedPrice: 2,
    lat: 42.375,
    lng: 21.1504,
    notes: 'The lane is narrow and adjacent to bus stop. Users may be ticketed; need higher visibility and restriction signage.',
    riskLevel: 'high',
    photos: [
      'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: 'PK-2416',
    userName: 'Mimoza K.',
    submittedAt: 'Mon • 11:20',
    city: 'Prishtina',
    address: 'Rr. Luan Haradinaj 16',
    parkingType: 'Paid Public',
    proposedPrice: 1.2,
    lat: 42.6556,
    lng: 21.1637,
    notes: 'Garage access is via neon-lit side lane. Service gate is only partly visible from road and could require verification in person.',
    riskLevel: 'medium',
    photos: [
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=900&q=80',
    ],
  },
]

const styles = `
  .admin-dashboard {
    --bg: #edf2f9;
    --surface: #ffffff;
    --surface-muted: #f4f7fb;
    --surface-strong: #e9eef7;
    --line: #dde6f2;
    --primary: #285ef7;
    --primary-soft: #eaf1ff;
    --success: #25b574;
    --success-soft: #e8faf1;
    --warning: #ffb020;
    --warning-soft: #fff4dd;
    --danger: #ef4d60;
    --danger-soft: #ffe8ec;
    --text: #122033;
    --text-muted: #5f7288;
    --shadow: 0 16px 40px rgba(18, 32, 51, 0.12);
  }

  * { box-sizing: border-box; }

  .admin-dashboard {
    min-height: 100vh;
    width: 100%;
    background:
      radial-gradient(circle at top left, rgba(40, 94, 247, 0.08), transparent 24%),
      linear-gradient(180deg, #f5f8fc 0%, var(--bg) 100%);
    color: var(--text);
    font-family: Inter, 'Segoe UI', sans-serif;
    padding: 28px;
  }

  .dashboard-shell {
    max-width: 1600px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(221, 230, 242, 0.9);
    border-radius: 28px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 24px 18px;
    background: rgba(255, 255, 255, 0.78);
    border-bottom: 1px solid var(--line);
  }

  .header-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-muted);
    font-weight: 800;
  }

  .header-title {
    font-size: 28px;
    letter-spacing: -0.06em;
    font-weight: 800;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ghost-button,
  .primary-button,
  .danger-button,
  .highlight-button {
    appearance: none;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .ghost-button:hover,
  .primary-button:hover,
  .danger-button:hover,
  .highlight-button:hover { transform: translateY(-1px); }

  .ghost-button {
    background: var(--surface-muted);
    color: var(--text);
    border: 1px solid var(--line);
    padding: 10px 14px;
  }

  .primary-button {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 10px 22px rgba(40, 94, 247, 0.22);
    padding: 10px 18px;
  }

  .danger-button {
    background: var(--danger-soft);
    color: #a12e40;
    padding: 10px 18px;
  }

  .highlight-button {
    background: var(--warning-soft);
    color: #925f00;
    padding: 10px 18px;
  }

  .metrics-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(200px, 1fr));
    gap: 16px;
    padding: 18px 24px 0;
    background: rgba(255, 255, 255, 0.56);
  }

  .metric-card {
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metric-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .metric-value {
    font-size: clamp(26px, 2vw, 34px);
    font-weight: 800;
    letter-spacing: -0.06em;
  }

  .metric-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  .metric-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--primary);
  }

  .metric-dot.success { background: var(--success); }
  .metric-dot.warning { background: var(--warning); }

  .layout {
    display: grid;
    grid-template-columns: 350px minmax(0, 1fr);
    min-height: 780px;
    padding: 18px 20px 20px;
    gap: 20px;
  }

  .sidebar {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid var(--line);
    border-radius: 24px;
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
  }

  .sidebar-badge {
    background: var(--primary-soft);
    color: var(--primary);
    padding: 6px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    font-weight: 700;
    text-align: left;
    width: 100%;
  }

  .nav-item.active {
    background: var(--primary-soft);
    border-color: rgba(40, 94, 247, 0.12);
    color: var(--primary);
  }

  .nav-item .label {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nav-swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.8;
  }

  .nav-count {
    min-width: 28px;
    height: 24px;
    border-radius: 999px;
    background: var(--surface-strong);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: var(--text);
  }

  .nav-item.active .nav-count {
    background: rgba(40, 94, 247, 0.12);
    color: var(--primary);
  }

  .filter-panel {
    margin-top: 8px;
    background: var(--surface-muted);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 9px 12px;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font: inherit;
  }

  .select-box {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 9px 12px;
    color: var(--text);
  }

  .select-box select {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .queue-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 6px 2px;
  }

  .queue-header h3 {
    margin: 0;
    font-size: 15px;
  }

  .queue-header span {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
    padding-right: 4px;
  }

  .submission-card {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 14px 14px 12px;
    display: grid;
    gap: 12px;
    cursor: pointer;
    transition: border 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  .submission-card:hover {
    transform: translateY(-1px);
  }

  .submission-card.active {
    border-color: rgba(40, 94, 247, 0.35);
    box-shadow: 0 10px 24px rgba(40, 94, 247, 0.08);
    background: linear-gradient(180deg, #ffffff 0%, #f6f9ff 100%);
  }

  .submission-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .submission-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, #d9e5ff, #eef3ff);
    color: var(--primary);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 800;
  }

  .submission-name {
    font-weight: 800;
    font-size: 15px;
  }

  .submission-time {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .chip.low { background: var(--success-soft); color: #138355; }
  .chip.medium { background: var(--warning-soft); color: #986500; }
  .chip.high { background: var(--danger-soft); color: #a72f41; }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  .meta-grid strong {
    color: var(--text);
  }

  .content-panel {
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid var(--line);
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .inspection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.8);
  }

  .submission-id {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
  }

  .submission-id .tag {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 5px rgba(37, 181, 116, 0.12);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 7px 10px;
    background: var(--warning-soft);
    color: #986500;
  }

  .status-pill.success {
    background: var(--success-soft);
    color: #138355;
  }

  .inspection-body {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(0, 1.1fr);
    min-height: 0;
    gap: 0;
    flex: 1;
  }

  .detail-column,
  .verification-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .detail-column {
    border-right: 1px solid var(--line);
  }

  .detail-panel,
  .verification-panel {
    padding: 18px 20px;
    min-height: 0;
  }

  .detail-panel {
    display: grid;
    gap: 18px;
    overflow: auto;
  }

  .spot-summary {
    display: grid;
    gap: 16px;
  }

  .summary-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .summary-title {
    margin: 0;
    font-size: 24px;
    letter-spacing: -0.04em;
  }

  .price-tag {
    background: var(--success-soft);
    color: #0c7d4f;
    padding: 8px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 800;
  }

  .summary-address {
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 600;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .summary-item {
    background: var(--surface-muted);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .summary-item .label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .summary-item .value {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  .submission-notes {
    background: var(--surface-muted);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 16px;
    display: grid;
    gap: 10px;
  }

  .submission-notes h4,
  .verification-panel h4,
  .gallery-header h4 {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .submission-notes p {
    margin: 0;
    color: var(--text);
    line-height: 1.6;
    font-size: 14px;
  }

  .verification-panel {
    display: grid;
    gap: 18px;
    overflow: auto;
  }

  .streetview-box {
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #eef3f8;
    box-shadow: inset 0 0 0 1px rgba(18, 32, 51, 0.03);
  }

  .streetview-box iframe {
    display: block;
    width: 100%;
    height: 250px;
    border: 0;
    background: #dce7f3;
  }

  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .photo-tile {
    position: relative;
    aspect-ratio: 1.1 / 1;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #edf3ff;
  }

  .photo-tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 18px 20px 20px;
    border-top: 1px solid var(--line);
    background: rgba(248, 251, 255, 0.9);
  }

  .approve-button {
    background: linear-gradient(180deg, #2d6af7 0%, #1e56e5 100%);
    color: #fff;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 800;
    box-shadow: 0 12px 24px rgba(40, 94, 247, 0.18);
  }

  .reject-select {
    min-width: 220px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px;
    color: var(--text);
    font: inherit;
    outline: none;
  }

  .flag-button {
    background: var(--warning-soft);
    color: #925f00;
    padding: 13px 18px;
    border-radius: 12px;
    font-weight: 800;
  }

  @media (max-width: 1180px) {
    .layout {
      grid-template-columns: 300px minmax(0, 1fr);
    }

    .inspection-body {
      grid-template-columns: 1fr;
    }

    .detail-column {
      border-right: none;
      border-bottom: 1px solid var(--line);
    }
  }

  @media (max-width: 960px) {
    .admin-dashboard {
      padding: 12px;
    }

    .metrics-bar {
      grid-template-columns: 1fr;
    }

    .layout {
      grid-template-columns: 1fr;
    }
  }
`

function formatPrice(price: number) {
  return price === 0 ? 'Free' : `€${price.toFixed(2)}`
}

type MetricCardProps = {
  label: string
  value: string
  meta: string
  tone: 'primary' | 'success' | 'warning'
}

function MetricCard({ label, value, meta, tone }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        <span>{label}</span>
        <span className={`metric-dot ${tone}`} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-meta">
        <span>{meta}</span>
      </div>
    </div>
  )
}

type SidebarNavItemProps = {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function SidebarNavItem({ label, count, active, onClick }: SidebarNavItemProps) {
  return (
    <button type="button" className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="label">
        <span className="nav-swatch" />
        {label}
      </span>
      <span className="nav-count">{count}</span>
    </button>
  )
}

type SubmissionCardProps = {
  submission: SpotSubmission
  active: boolean
  onSelect: () => void
}

function SubmissionCard({ submission, active, onSelect }: SubmissionCardProps) {
  return (
    <div
      className={`submission-card ${active ? 'active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="submission-top">
        <div className="submission-meta">
          <div className="avatar">{submission.userName.charAt(0)}</div>
          <div>
            <div className="submission-name">{submission.userName}</div>
            <div className="submission-time">{submission.submittedAt}</div>
          </div>
        </div>
        <span className={`chip ${submission.riskLevel}`}>{submission.riskLevel}</span>
      </div>

      <div className="meta-grid">
        <div><strong>{submission.parkingType}</strong></div>
        <div><strong>{formatPrice(submission.proposedPrice)}</strong></div>
        <div>{submission.city}</div>
        <div>{submission.id}</div>
      </div>
    </div>
  )
}

function StreetViewEmbed({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="streetview-box">
      <iframe
        title="Street View verification"
        src={`https://www.google.com/maps?q=${lat},${lng}&z=18&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=embed`}
        loading="lazy"
        allowFullScreen
      />
    </div>
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<NavKey>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [cityFilter, setCityFilter] = useState('All cities')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rejectReason, setRejectReason] = useState(rejectionReasons[0])

  const filteredSubmissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return submissions.filter((item) => {
      const cityMatches = cityFilter === 'All cities' || item.city === cityFilter
      const textMatches =
        term.length === 0 ||
        item.userName.toLowerCase().includes(term) ||
        item.address.toLowerCase().includes(term) ||
        item.city.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term)
      return cityMatches && textMatches
    })
  }, [cityFilter, searchTerm])

  useEffect(() => {
    if (selectedIndex > filteredSubmissions.length - 1) {
      setSelectedIndex(Math.max(filteredSubmissions.length - 1, 0))
    }
  }, [filteredSubmissions.length, selectedIndex])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return
      }

      if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        handleApprove()
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        handleReject()
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setSelectedIndex((current) => {
          if (filteredSubmissions.length === 0) return 0
          return (current + 1) % filteredSubmissions.length
        })
      }
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [filteredSubmissions.length])

  const selectedSubmission = filteredSubmissions[selectedIndex] ?? filteredSubmissions[0] ?? submissions[0]

  const handleApprove = () => {
    if (!filteredSubmissions.length) return
    setSelectedIndex((current) => (current + 1) % filteredSubmissions.length)
  }

  const handleReject = () => {
    if (!filteredSubmissions.length) return
    setSelectedIndex((current) => (current + 1) % filteredSubmissions.length)
  }

  const handleFlag = () => {
    if (!filteredSubmissions.length) return
    setSelectedIndex((current) => (current + 1) % filteredSubmissions.length)
  }

  return (
    <div className="admin-dashboard">
      <style>{styles}</style>

      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div className="header-title-wrap">
            <span className="eyebrow">Community parking OS</span>
            <h1 className="header-title">Admin Dashboard</h1>
          </div>

          <div className="header-actions">
            <button className="ghost-button" type="button">Export queue</button>
            <button className="primary-button" type="button">Live sync</button>
          </div>
        </header>

        <section className="metrics-bar" aria-label="quick metrics">
          <MetricCard label="Total Pending" value={String(submissions.length)} meta="Queue needs review" tone="primary" />
          <MetricCard label="Total Approved" value="4,382" meta="+127 this week" tone="success" />
          <MetricCard label="Spider / Police Alerts" value="18" meta="Today • 5 critical" tone="warning" />
        </section>

        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h3>Navigation</h3>
              <span className="sidebar-badge">Ops</span>
            </div>

            <nav className="nav-list" aria-label="Sidebar navigation">
              {sidebarItems.map((item) => (
                <SidebarNavItem
                  key={item.key}
                  label={item.label}
                  count={item.count ?? 0}
                  active={activeTab === item.key}
                  onClick={() => setActiveTab(item.key)}
                />
              ))}
            </nav>

            <div className="filter-panel">
              <div className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search submissions"
                  aria-label="Search submissions"
                />
              </div>

              <div className="select-box">
                <label htmlFor="city-filter" style={{ display: 'none' }}>Filter by city</label>
                <select id="city-filter" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="queue-panel">
              <div className="queue-header">
                <h3>Review queue</h3>
                <span>{filteredSubmissions.length} spots</span>
              </div>

              <div className="queue-list">
                {filteredSubmissions.length === 0 ? (
                  <div className="submission-card" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    No submissions match the current filters.
                  </div>
                ) : (
                  filteredSubmissions.map((submission, index) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      active={index === selectedIndex}
                      onSelect={() => setSelectedIndex(index)}
                    />
                  ))
                )}
              </div>
            </div>
          </aside>

          <main className="content-panel">
            <div className="inspection-header">
              <div className="submission-id">
                <span className="tag" aria-hidden="true" />
                <span>{selectedSubmission.id}</span>
              </div>

              <div className="header-right">
                <span className="status-pill success">Verified</span>
                <button className="ghost-button" type="button">Open dossier</button>
              </div>
            </div>

            <div className="inspection-body">
              <div className="detail-column">
                <div className="detail-panel">
                  <div className="spot-summary">
                    <div className="summary-head">
                      <h2 className="summary-title">{selectedSubmission.address}</h2>
                      <span className="price-tag">{formatPrice(selectedSubmission.proposedPrice)}</span>
                    </div>

                    <div className="summary-address">
                      {selectedSubmission.city} • {selectedSubmission.parkingType}
                    </div>

                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="label">Submitted by</span>
                        <span className="value">{selectedSubmission.userName}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Timestamp</span>
                        <span className="value">{selectedSubmission.submittedAt}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Risk</span>
                        <span className="value">{selectedSubmission.riskLevel.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="submission-notes">
                    <h4>Moderator notes</h4>
                    <p>{selectedSubmission.notes}</p>
                  </div>
                </div>
              </div>

              <div className="verification-column">
                <div className="verification-panel">
                  <StreetViewEmbed lat={selectedSubmission.lat} lng={selectedSubmission.lng} />

                  <div className="gallery-header">
                    <h4>Photos</h4>
                    <span className="status-pill">{selectedSubmission.photos.length} files</span>
                  </div>

                  <div className="gallery-grid">
                    {selectedSubmission.photos.map((photo, index) => (
                      <div key={`${selectedSubmission.id}-photo-${index}`} className="photo-tile">
                        <img src={photo} alt={`${selectedSubmission.address} photo ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="action-bar">
                  <button className="approve-button" type="button" onClick={handleApprove}>Approve &amp; Publish</button>

                  <select
                    className="reject-select"
                    aria-label="Reject reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  >
                    {rejectionReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>

                  <button className="danger-button" type="button" onClick={handleReject}>Reject</button>
                  <button className="flag-button" type="button" onClick={handleFlag}>Flag for In-Person Inspection</button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
