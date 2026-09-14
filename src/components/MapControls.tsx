import type { Filters } from "../types";

export function MapControls({ filters, onChange, onLocate }: { filters: Filters; onChange: (filters: Filters) => void; onLocate?: () => void }) {
  return (
    <div className="map-action-row">
      <button className="map-action-button" onClick={() => onChange({ ...filters, availableOnly: !filters.availableOnly })}>
        <b>{filters.availableOnly ? "Të gjitha" : "Të lira"}</b>
      </button>
      <button className="map-action-button" onClick={() => onChange({ ...filters, freeOnly: !filters.freeOnly, paidOnly: false })}>
        <b>Falas</b>
      </button>
      {onLocate && <button className="map-action-button" onClick={onLocate}><b>Lokacioni</b></button>}
    </div>
  );
}
