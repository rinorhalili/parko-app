import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { AppIcon, type AppIconName } from './Icon'

/** Presentation only: callers retain their snap state, gestures and close behavior. */
export const BottomSheet = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function BottomSheet({ className = '', ...props }, ref) {
  return <section ref={ref} className={`ui-sheet ${className}`} {...props} />
})

export function SheetHandle({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`ui-sheet-handle ${className}`} {...props}><span className="drag-handle" aria-hidden="true" />{children}</button>
}

export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`button ui-primary ${className}`} {...props}>{children}</button>
}

export function MapFloatingControl({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`map-action-button ${className}`} {...props}>{children}</button>
}

export function ParkingActions({ onNavigate, onDetails, onStreetView }: { onNavigate: () => void; onDetails: () => void; onStreetView: () => void }) {
  return <div className="parking-actions">
    <PrimaryButton onClick={onNavigate}><AppIcon name="route" />Shko këtu</PrimaryButton>
    <div className="parking-actions__secondary">
      <button type="button" onClick={onDetails}><AppIcon name="info" size={18} />Detaje</button>
      <button type="button" onClick={onStreetView}><AppIcon name="street" size={18} />Street View</button>
    </div>
  </div>
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <span className={`ui-status ui-status--${tone}`}><i aria-hidden="true" />{children}</span>
}

export function InfoRow({ icon, label, children }: { icon: AppIconName; label?: string; children: ReactNode }) {
  return <div className="ui-info-row"><AppIcon name={icon} /><div>{label && <small>{label}</small>}<span>{children}</span></div></div>
}

export function TripSummary({ minutes, eta, distance, arrived }: { minutes: string; eta: string; distance: string; arrived: boolean }) {
  return <div className="trip-metrics">
    <div><strong>{minutes}<span> min</span></strong><small>{arrived ? 'Udhëtimi përfundoi' : 'Koha e mbetur'}</small></div>
    <div><strong>{eta}</strong><small>{arrived ? 'Mbërritur në' : 'Mbërritja · ETA'}</small></div>
    <div><strong>{distance}</strong><small>{arrived ? 'Në destinacion' : 'Distanca'}</small></div>
  </div>
}
