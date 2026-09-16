/** Leaflet presentation only; count, clustering, coordinates and selection remain in the map. */
export function parkingMarkerHtml({ color, category, selected, restricted, large }: { color: string; category: string; selected: boolean; restricted: boolean; large: boolean }) {
  const size = selected ? (large ? 34 : 30) : (large ? 28 : 24)
  return `<span class="parking-marker-hit"><span aria-hidden="true" class="parking-point parking-point--${category}${selected ? ' parking-point--selected' : ''}${restricted ? ' parking-point--restricted' : ''}" style="--parking-point-color:${color};--parking-point-size:${size}px">P</span></span>`
}
