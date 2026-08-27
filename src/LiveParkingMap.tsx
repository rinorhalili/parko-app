import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { USER_LOCATION } from './parkingApi'
import { accessPointIsEstimated, parkingAccessPoint } from './parkingGeometry'
import type { Destination, DrivingRoute, Parking, ParkingLoadStatus } from './types'

type MapMode = 'home' | 'details' | 'navigation' | 'walking'

function priceClass(price: number | null) {
  if (price === null) return 'unknown'
  if (price === 0) return 'free'
  if (price <= 0.5) return 'low'
  if (price <= 1) return 'medium'
  return 'high'
}

function priceLabel(price: number | null) {
  if (price === null) return 'Çmimi nuk dihet'
  if (price === 0) return 'Falas'
  return `${price.toFixed(2)} €/orë`
}

function areaColor(price: number | null) {
  if (price === null) return '#738195'
  if (price === 0) return '#17b978'
  if (price <= 0.5) return '#2f6bff'
  if (price <= 1) return '#f59e0b'
  return '#ef5350'
}

function createPopup(parking: Parking) {
  const popup = document.createElement('div')
  popup.className = 'parking-popup'
  const title = document.createElement('strong')
  title.textContent = parking.name
  const meta = document.createElement('span')
  const municipalLabel = parking.municipalZone
    ? `Prishtina Parking · Zona ${parking.municipalZone}`
    : parking.municipalManaged ? 'Prishtina Parking · zona nuk është konfirmuar' : parking.zone
  meta.textContent = `${municipalLabel} · ${priceLabel(parking.pricePerHour)}`
  const spaces = document.createElement('small')
  spaces.textContent = parking.spaces !== null
    ? `${parking.spaces} vende të lira`
    : parking.capacity !== null ? `Kapacitet i hartuar: ${parking.capacity}` : 'Kapaciteti nuk dihet'
  popup.append(title, meta, spaces)
  return popup
}

export default function LiveParkingMap({
  parkings,
  selected,
  onSelect,
  mode = 'home',
  loadStatus = 'live',
  route,
  destination,
  walkMinutes = 10,
  recommendationRanks,
  recenterToken = 0,
  userLocation = USER_LOCATION,
}: {
  parkings: Parking[]
  selected: Parking
  onSelect: (parking: Parking) => void
  mode?: MapMode
  loadStatus?: ParkingLoadStatus
  route?: DrivingRoute | null
  destination?: Destination | null
  walkMinutes?: 5 | 10 | 15
  recommendationRanks?: Map<string, number>
  recenterToken?: number
  userLocation?: Parking['coordinates']
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const parkingLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const modeRef = useRef(mode)
  const focusParkingRef = useRef<string | null>(null)
  const [mapZoom, setMapZoom] = useState(14)
  onSelectRef.current = onSelect
  modeRef.current = mode

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [42.6608, 21.1608],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: 'Harta: <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> · <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    }).addTo(map)
    map.createPane('mapLabels')
    const labelsPane = map.getPane('mapLabels')
    if (labelsPane) {
      labelsPane.style.zIndex = '425'
      labelsPane.style.pointerEvents = 'none'
    }
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      pane: 'mapLabels',
      subdomains: 'abcd',
      minZoom: 11,
      maxZoom: 20,
      opacity: .88,
    }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)
    map.createPane('parkingAreas')
    const parkingPane = map.getPane('parkingAreas')
    if (parkingPane) parkingPane.style.zIndex = '420'
    parkingLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)
    map.on('zoomend', () => setMapZoom(map.getZoom()))
    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!recenterToken || !mapRef.current || mode !== 'home') return
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 16, { duration: .45 })
  }, [recenterToken, mode, userLocation.lat, userLocation.lng])

  useEffect(() => {
    const map = mapRef.current
    const parkingLayer = parkingLayerRef.current
    const routeLayer = routeLayerRef.current
    if (!map || !parkingLayer || !routeLayer) return
    parkingLayer.clearLayers()
    routeLayer.clearLayers()

    const visibleParkings = mode === 'navigation' || mode === 'walking' ? [selected] : parkings

    visibleParkings.forEach((parking) => {
      if (!parking.geometry?.length && mapZoom < 13.5) return
      const category = priceClass(parking.pricePerHour)
      const isSelected = selected.id === parking.id
      const rank = recommendationRanks?.get(parking.id)
      const restricted = ['customers', 'private', 'permit', 'no'].includes(parking.access)
      const color = areaColor(parking.pricePerHour)
      const interactiveLayers: L.Path[] = parking.geometry?.length
        ? parking.geometry.map((ring) => L.polygon(
          ring.map(({ lat, lng }) => [lat, lng] as L.LatLngTuple),
          {
            pane: 'parkingAreas',
            className: `parking-area parking-area--${category}${isSelected ? ' parking-area--selected' : ''}${restricted ? ' parking-area--restricted' : ''}`,
            color: isSelected ? '#143b9b' : color,
            weight: isSelected ? 4 : mapZoom < 14 ? 1.25 : 2,
            opacity: .95,
            fillColor: color,
            fillOpacity: isSelected ? .52 : mapZoom < 14 ? .2 : .34,
            lineJoin: 'round',
          },
        ))
        : [L.circleMarker([parking.coordinates.lat, parking.coordinates.lng], {
          pane: 'parkingAreas',
          className: `parking-point parking-point--${category}${isSelected ? ' parking-point--selected' : ''}${restricted ? ' parking-point--restricted' : ''}`,
          radius: isSelected ? 7 : 4.5,
          color: isSelected ? '#143b9b' : '#fff',
          weight: isSelected ? 3 : 1.5,
          fillColor: color,
          fillOpacity: restricted ? .45 : .9,
        })]

      interactiveLayers.forEach((layer) => {
        layer.bindPopup(createPopup(parking), { closeButton: false })
        const showParkingLabel = mapZoom >= 17 && (isSelected || Boolean(rank && rank <= 3))
        layer.bindTooltip(rank ? `#${rank} · ${parking.name} · ${priceLabel(parking.pricePerHour)}` : `${parking.name} · ${priceLabel(parking.pricePerHour)}`, {
          permanent: showParkingLabel,
          direction: 'top',
          className: 'parking-rank-tooltip',
        })
        layer.on('click', (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent)
          focusParkingRef.current = parking.id
          onSelectRef.current(parking)
        })
        layer.addTo(parkingLayer)
        const element = layer.getElement()
        element?.setAttribute('role', 'button')
        element?.setAttribute('aria-label', `${parking.name} · ${priceLabel(parking.pricePerHour)}`)
        element?.setAttribute('tabindex', '0')
        element?.addEventListener('keydown', (event) => {
          const keyboardEvent = event as KeyboardEvent
          if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return
          event.preventDefault()
          focusParkingRef.current = parking.id
          onSelectRef.current(parking)
        })
      })
    })

    const userIcon = L.divIcon({
      className: '',
      html: '<span class="live-user-location"><i></i></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, interactive: false }).addTo(routeLayer)

    if (destination) {
      if (mode === 'home') {
        const walkRadius = walkMinutes * 64
        L.circle([destination.coordinates.lat, destination.coordinates.lng], {
        radius: walkRadius,
        color: '#7c8cff',
        weight: 2,
        opacity: .72,
        dashArray: '6 7',
        fillColor: '#8aa6ff',
        fillOpacity: .09,
        interactive: false,
        }).addTo(routeLayer)
      }
      const destinationIcon = L.divIcon({
        className: '',
        html: '<span class="destination-marker"><b>⌂</b></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 38],
      })
      L.marker([destination.coordinates.lat, destination.coordinates.lng], {
        icon: destinationIcon,
        title: destination.name,
        alt: destination.name,
        zIndexOffset: 1200,
      }).addTo(routeLayer)

      if (selected.geometry?.length) {
        const accessPoint = parkingAccessPoint(selected, destination.coordinates)
        const accessIcon = L.divIcon({
          className: '',
          html: `<span class="parking-access-point" title="${accessPointIsEstimated(selected) ? 'Hyrje e përafërt nga konturi' : 'Hyrje e hartuar'}"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })
        L.marker([accessPoint.lat, accessPoint.lng], { icon: accessIcon, interactive: false, zIndexOffset: 1100 }).addTo(routeLayer)
      }
    } else if (mapZoom >= 17 && selected.geometry?.length) {
      const accessPoint = parkingAccessPoint(selected, userLocation)
      const accessIcon = L.divIcon({
        className: '',
        html: `<span class="parking-access-point" title="${accessPointIsEstimated(selected) ? 'Hyrje e përafërt nga konturi' : 'Hyrje e hartuar'}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      L.marker([accessPoint.lat, accessPoint.lng], { icon: accessIcon, interactive: false, zIndexOffset: 1100 }).addTo(routeLayer)
    }

    if (mode === 'home' && destination && destination.source !== 'map') {
      const focusPoints = [destination.coordinates, ...parkings.map((parking) => parking.coordinates)]
        .map(({ lat, lng }) => [lat, lng] as L.LatLngTuple)
      map.fitBounds(focusPoints, {
        paddingTopLeft: [35, 235],
        paddingBottomRight: [35, 385],
        maxZoom: 16,
        animate: false,
      })
    }

    if (mode === 'home' && focusParkingRef.current === selected.id) {
      const footprintPoints = selected.geometry?.flat().map(({ lat, lng }) => [lat, lng] as L.LatLngTuple) ?? []
      if (footprintPoints.length >= 3) {
        map.fitBounds(L.latLngBounds(footprintPoints), { padding: [78, 78], maxZoom: 18, animate: true })
      } else {
        map.flyTo([selected.coordinates.lat, selected.coordinates.lng], Math.max(map.getZoom(), 17), { duration: .45 })
      }
      focusParkingRef.current = null
    }

    if (route && (mode === 'home' || mode === 'navigation' || mode === 'details' || mode === 'walking')) {
      const routePoints: L.LatLngExpression[] = route.coordinates.map(({ lat, lng }) => [lat, lng])
      const routeColor = mode === 'walking' ? '#18b981' : '#2f6bff'
      L.polyline(routePoints, { color: '#16325c', weight: 13, opacity: 0.16, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: '#ffffff', weight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: routeColor, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: mode === 'walking' ? '9 8' : undefined }).addTo(routeLayer)

      if (mode === 'navigation' || mode === 'walking') {
        map.fitBounds(L.latLngBounds(routePoints), {
          paddingTopLeft: [44, 120],
          paddingBottomRight: [44, 205],
          animate: false,
        })
      } else if (mode === 'home') {
        map.fitBounds(L.latLngBounds(routePoints), {
          paddingTopLeft: [35, 235],
          paddingBottomRight: [35, 405],
          maxZoom: 16,
          animate: false,
        })
      } else {
        map.fitBounds(L.latLngBounds(routePoints), {
          paddingTopLeft: [45, 65],
          paddingBottomRight: [45, 525],
          maxZoom: 15,
          animate: false,
        })
      }
    }

    if (mode === 'details' && destination) {
      const walkingConnection: L.LatLngExpression[] = [
        [selected.coordinates.lat, selected.coordinates.lng],
        [destination.coordinates.lat, destination.coordinates.lng],
      ]
      L.polyline(walkingConnection, { color: '#fff', weight: 7, opacity: .95 }).addTo(routeLayer)
      L.polyline(walkingConnection, { color: '#18b981', weight: 4, opacity: .95, dashArray: '8 7' }).addTo(routeLayer)
    }

    if (mode === 'navigation' && !route) {
      map.fitBounds([[userLocation.lat, userLocation.lng], [selected.coordinates.lat, selected.coordinates.lng]], { padding: [70, 70], animate: false })
    } else if (mode === 'details' && !route) {
      map.setView([selected.coordinates.lat, selected.coordinates.lng], 15, { animate: false })
    }
  }, [parkings, selected, mode, route, destination, walkMinutes, recommendationRanks, userLocation.lat, userLocation.lng, mapZoom])

  return (
    <div className={`map-canvas map-canvas--${mode} ${destination ? 'map-canvas--destination' : ''}`} aria-label="Harta reale e parkingjeve në Prishtinë">
      <div ref={containerRef} className="leaflet-map" />
      {mode === 'home' && destination && (
        <div className="price-legend" aria-label="Kategoritë e çmimeve">
          <span className="price-legend__status">{destination ? `${parkings.length} parkingje • ${walkMinutes} min ecje` : loadStatus === 'loading' ? `${parkings.length} parkingje • duke rifreskuar` : loadStatus === 'live' ? `${parkings.length} zona parkingu` : `${parkings.length} parkingje OSM`}</span>
          <span><i className="price-dot price-dot--free" />Falas</span>
          <span><i className="price-dot price-dot--low" />≤0.50€</span>
          <span><i className="price-dot price-dot--medium" />≤1€</span>
          <span><i className="price-dot price-dot--high" />&gt;1€</span>
          <span><i className="price-dot price-dot--unknown" />Pa çmim</span>
        </div>
      )}
      {(mode === 'home' || mode === 'navigation' || mode === 'details' || mode === 'walking') && route && (
        <div className={`route-engine-badge route-engine-badge--${mode}`}>
          <i /> {route.source === 'osrm' ? 'Rutë reale' : route.source === 'valhalla' ? 'Rutë reale në këmbë' : route.source === 'walking' ? 'Udhëzim në këmbë' : route.source === 'estimated-walking' ? 'Ecje e përafërt' : 'Rutë paraprake'}
        </div>
      )}
    </div>
  )
}
