import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { PRISHTINA_CENTER, PRISHTINA_MAP_BOUNDS, USER_LOCATION, isWithinPrishtinaMap } from './parkingApi'
import { accessPointIsEstimated, parkingAccessPoint } from './parkingGeometry'
import type { Destination, DrivingRoute, Parking, ParkingLoadStatus } from './types'
import { useCrowdSourcing } from './crowdsourcing'

type MapMode = 'home' | 'details' | 'navigation' | 'walking'
const PRISHTINA_LEAFLET_BOUNDS: [L.LatLngTuple, L.LatLngTuple] = [
  [PRISHTINA_MAP_BOUNDS.south, PRISHTINA_MAP_BOUNDS.west],
  [PRISHTINA_MAP_BOUNDS.north, PRISHTINA_MAP_BOUNDS.east],
]

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
  pickingDestination = false,
  onPickDestination,
  recenterToken = 0,
  userLocation = USER_LOCATION,
  userLocationLive = false,
  userLocationAccuracy = null,
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
  pickingDestination?: boolean
  onPickDestination?: (coordinates: { lat: number; lng: number }) => void
  recenterToken?: number
  userLocation?: Parking['coordinates']
  userLocationLive?: boolean
  userLocationAccuracy?: number | null
}) {
  const { departures } = useCrowdSourcing()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const parkingLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const onPickDestinationRef = useRef(onPickDestination)
  const pickingDestinationRef = useRef(pickingDestination)
  const modeRef = useRef(mode)
  const focusParkingRef = useRef<string | null>(null)
  const automaticViewportRef = useRef<string | null>(null)
  const [mapZoom, setMapZoom] = useState(14)
  onSelectRef.current = onSelect
  onPickDestinationRef.current = onPickDestination
  pickingDestinationRef.current = pickingDestination
  modeRef.current = mode

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const cityBounds = L.latLngBounds(PRISHTINA_LEAFLET_BOUNDS)
    const map = L.map(containerRef.current, {
      center: [PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng],
      zoom: 13,
      minZoom: 12,
      maxBounds: cityBounds.pad(0.08),
      maxBoundsViscosity: 1,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      maxZoom: 19,
      attribution: 'Harta: <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)
    map.createPane('parkingAreas')
    const parkingPane = map.getPane('parkingAreas')
    if (parkingPane) parkingPane.style.zIndex = '420'
    parkingLayerRef.current = L.layerGroup().addTo(map)
    routeLayerRef.current = L.layerGroup().addTo(map)
    map.on('click', (event) => {
      if (modeRef.current !== 'home' || !pickingDestinationRef.current) return
      const coordinates = { lat: event.latlng.lat, lng: event.latlng.lng }
      if (!isWithinPrishtinaMap(coordinates)) return
      onPickDestinationRef.current?.(coordinates)
    })
    map.on('zoomend', () => setMapZoom(map.getZoom()))
    mapRef.current = map
    map.fitBounds(cityBounds, { padding: [14, 14], animate: false })
    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!recenterToken || !mapRef.current || mode !== 'home') return
    if (!isWithinPrishtinaMap(userLocation)) {
      mapRef.current.flyTo([PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng], 13, { duration: .45 })
      return
    }
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 16, { duration: .45 })
  }, [recenterToken, mode, userLocation.lat, userLocation.lng])

  useEffect(() => {
    const map = mapRef.current
    const parkingLayer = parkingLayerRef.current
    const routeLayer = routeLayerRef.current
    if (!map || !parkingLayer || !routeLayer) return
    parkingLayer.clearLayers()
    routeLayer.clearLayers()
    if (mode === 'home' && !destination && !route) automaticViewportRef.current = null

    const visibleParkings = mode === 'navigation' || mode === 'walking' ? [selected] : parkings

    visibleParkings.forEach((parking) => {
      const usefulOverviewPoint = parking.pricePerHour !== null || parking.free || Boolean(parking.availabilitySource)
      if (!parking.geometry?.length && mapZoom < (destination ? 13.5 : 15) && !usefulOverviewPoint) return
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
          if (pickingDestinationRef.current) {
            onPickDestinationRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng })
            return
          }
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

    departures.forEach((departure) => {
      const departureIcon = L.divIcon({
        className: '',
        html: `<span class="crowd-departure-marker"><b>↗</b><small>${departure.minutes}′</small></span>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      })
      L.marker([departure.coordinates.lat, departure.coordinates.lng], { icon: departureIcon, title: `Po largohet për ${departure.minutes} minuta`, zIndexOffset: 900 })
        .bindTooltip(`Po largohet për ${departure.minutes} minuta`, { direction: 'top', className: 'crowd-departure-tooltip' })
        .addTo(routeLayer)
    })

    if (userLocationLive && isWithinPrishtinaMap(userLocation)) {
      if (userLocationAccuracy) {
        L.circle([userLocation.lat, userLocation.lng], {
          radius: Math.min(220, Math.max(12, userLocationAccuracy)),
          className: 'user-accuracy-ring',
          color: '#2f6bff',
          weight: 1,
          opacity: .34,
          fillColor: '#2f6bff',
          fillOpacity: .09,
          interactive: false,
        }).addTo(routeLayer)
      }
      const userIcon = L.divIcon({
        className: '',
        html: '<span class="live-user-location"><i></i></span>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, interactive: false }).addTo(routeLayer)
    }

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
      const isMapDestination = destination.source === 'map'
      const destinationIcon = L.divIcon({
        className: '',
        html: `<span class="destination-marker${isMapDestination ? ' destination-marker--map' : ''}"><b>${isMapDestination ? '●' : '⌂'}</b></span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 38],
      })
      L.marker([destination.coordinates.lat, destination.coordinates.lng], {
        icon: destinationIcon,
        title: destination.name,
        alt: destination.name,
        interactive: false,
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

    const shouldFocusSelectedParking = mode === 'home' && focusParkingRef.current === selected.id
    if (shouldFocusSelectedParking) {
      focusParkingRef.current = null
    }

    if (route && (mode === 'home' || mode === 'navigation' || mode === 'details' || mode === 'walking')) {
      const routePoints: L.LatLngExpression[] = route.coordinates.map(({ lat, lng }) => [lat, lng])
      const routeColor = mode === 'walking' ? '#18b981' : '#2f6bff'
      L.polyline(routePoints, { color: '#16325c', weight: 13, opacity: 0.16, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: '#ffffff', weight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: routeColor, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: mode === 'walking' ? '9 8' : undefined }).addTo(routeLayer)

      const firstPoint = route.coordinates[0]
      const lastPoint = route.coordinates[route.coordinates.length - 1]
      const routeViewportKey = `route:${mode}:${selected.id}:${route.source}:${firstPoint?.lat.toFixed(5)}:${firstPoint?.lng.toFixed(5)}:${lastPoint?.lat.toFixed(5)}:${lastPoint?.lng.toFixed(5)}`
      if (!shouldFocusSelectedParking && automaticViewportRef.current !== routeViewportKey) {
        automaticViewportRef.current = routeViewportKey
        if (mode === 'navigation' || mode === 'walking') {
          map.fitBounds(L.latLngBounds(routePoints), {
            paddingTopLeft: [44, 120],
            paddingBottomRight: [44, 205],
            animate: false,
          })
        } else if (mode === 'home' && !destination) {
          // A direct parking selection must not move the map away from the place the user was inspecting.
        } else if (mode === 'home') {
          map.fitBounds(L.latLngBounds(routePoints), {
            paddingTopLeft: [35, 185],
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
    } else if (!shouldFocusSelectedParking && mode === 'home' && destination && destination.source !== 'map') {
      const destinationViewportKey = `destination:${destination.id}:${walkMinutes}`
      if (automaticViewportRef.current !== destinationViewportKey) {
        automaticViewportRef.current = destinationViewportKey
        const focusPoints = [destination.coordinates, ...parkings.map((parking) => parking.coordinates)]
          .map(({ lat, lng }) => [lat, lng] as L.LatLngTuple)
        map.fitBounds(focusPoints, {
          paddingTopLeft: [35, 185],
          paddingBottomRight: [35, 385],
          maxZoom: 16,
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

    if (!shouldFocusSelectedParking && mode === 'navigation' && !route) {
      const navigationViewportKey = `navigation:${selected.id}:${userLocation.lat.toFixed(5)}:${userLocation.lng.toFixed(5)}`
      if (automaticViewportRef.current !== navigationViewportKey) {
        automaticViewportRef.current = navigationViewportKey
        map.fitBounds([[userLocation.lat, userLocation.lng], [selected.coordinates.lat, selected.coordinates.lng]], { padding: [70, 70], animate: false })
      }
    } else if (!shouldFocusSelectedParking && mode === 'details' && !route) {
      const detailsViewportKey = `details:${selected.id}`
      if (automaticViewportRef.current !== detailsViewportKey) {
        automaticViewportRef.current = detailsViewportKey
        map.setView([selected.coordinates.lat, selected.coordinates.lng], 15, { animate: false })
      }
    }
  }, [parkings, selected, mode, route, destination, walkMinutes, recommendationRanks, userLocation.lat, userLocation.lng, userLocationLive, userLocationAccuracy, mapZoom, departures])

  return (
    <div className={`map-canvas map-canvas--${mode} ${destination ? 'map-canvas--destination' : ''} ${pickingDestination ? 'map-canvas--picking' : ''}`} aria-label="Harta reale e parkingjeve në Prishtinë">
      <div ref={containerRef} className="leaflet-map" />
      <div className="map-city-badge"><b>Prishtinë</b><span>OSM live</span></div>
      {mode === 'home' && pickingDestination && <div className="map-pick-banner">Prek hartën për të vendosur destinacionin</div>}
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
