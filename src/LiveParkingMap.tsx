import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { PRISHTINA_CENTER, PRISHTINA_MAP_BOUNDS, USER_LOCATION, isWithinPrishtinaMap } from './parkingApi'
import { accessPointIsEstimated, parkingAccessPoint } from './parkingGeometry'
import type { Destination, DrivingRoute, MapSettings, MapVariant, Parking, ParkingLoadStatus, ParkingPalette } from './types'
import { useCrowdSourcing } from './crowdsourcing'

type MapMode = 'home' | 'details' | 'navigation' | 'walking'
const PRISHTINA_LEAFLET_BOUNDS: [L.LatLngTuple, L.LatLngTuple] = [
  [PRISHTINA_MAP_BOUNDS.south, PRISHTINA_MAP_BOUNDS.west],
  [PRISHTINA_MAP_BOUNDS.north, PRISHTINA_MAP_BOUNDS.east],
]

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  variant: 'standard',
  parkingPalette: 'green',
  emphasizeAreas: true,
  largePointMarkers: true,
  showPointParking: true,
  largeLabels: false,
  showDataSources: true,
}

const MAP_TILES: Record<MapVariant, {
  url: string
  labelsUrl?: string
  subdomains: string
  maxZoom: number
  attribution: string
}> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: 'Harta: <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },
  minimal: {
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    labelsUrl: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: 'Harta: <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> · <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
  },
}

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

function priceAreaColor(price: number | null) {
  if (price === null) return '#738195'
  if (price === 0) return '#17b978'
  if (price <= 0.5) return '#2f6bff'
  if (price <= 1) return '#f59e0b'
  return '#ef5350'
}

function areaColor(parking: Parking, palette: ParkingPalette) {
  if (palette === 'price') return priceAreaColor(parking.pricePerHour)
  if (palette === 'operator') {
    if (parking.municipalManaged) return '#2563eb'
    if (parking.type === 'private') return '#f08c28'
    if (parking.type === 'street') return '#12a56f'
    return '#18b978'
  }
  if (parking.municipalManaged) return '#2563eb'
  return ['customers', 'private', 'permit', 'no'].includes(parking.access) ? '#e59a2f' : '#10a968'
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
  onLongPress,
  onManualMove,
  recenterToken = 0,
  userLocation = USER_LOCATION,
  userLocationLive = false,
  userLocationAccuracy = null,
  mapSettings = DEFAULT_MAP_SETTINGS,
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
  onLongPress?: (coordinates: { lat: number; lng: number }) => void
  onManualMove?: () => void
  recenterToken?: number
  userLocation?: Parking['coordinates']
  userLocationLive?: boolean
  userLocationAccuracy?: number | null
  mapSettings?: MapSettings
}) {
  const { departures } = useCrowdSourcing()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseTileLayerRef = useRef<L.TileLayer | null>(null)
  const labelTileLayerRef = useRef<L.TileLayer | null>(null)
  const parkingLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const onPickDestinationRef = useRef(onPickDestination)
  const onLongPressRef = useRef(onLongPress)
  const onManualMoveRef = useRef(onManualMove)
  const pickingDestinationRef = useRef(pickingDestination)
  const modeRef = useRef(mode)
  const focusParkingRef = useRef<string | null>(null)
  const automaticViewportRef = useRef<string | null>(null)
  const manualViewportRef = useRef(false)
  const [mapZoom, setMapZoom] = useState(14)
  const [mapReadyToken, setMapReadyToken] = useState(0)
  onSelectRef.current = onSelect
  onPickDestinationRef.current = onPickDestination
  onLongPressRef.current = onLongPress
  onManualMoveRef.current = onManualMove
  pickingDestinationRef.current = pickingDestination
  modeRef.current = mode
  const visibleParkings = useMemo(
    () => mode === 'navigation' || mode === 'walking' ? [selected] : parkings,
    [mode, parkings, selected],
  )

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
      touchZoom: true,
      doubleClickZoom: true,
    })
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)
    map.createPane('mapLabels')
    const labelsPane = map.getPane('mapLabels')
    if (labelsPane) {
      labelsPane.style.zIndex = '350'
      labelsPane.style.pointerEvents = 'none'
    }
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
    map.on('contextmenu', (event) => {
      if (modeRef.current !== 'home') return
      const coordinates = { lat: event.latlng.lat, lng: event.latlng.lng }
      if (!isWithinPrishtinaMap(coordinates)) return
      onLongPressRef.current?.(coordinates)
    })
    const markManualViewport = () => {
      manualViewportRef.current = true
      onManualMoveRef.current?.()
    }
    map.on('dragstart', markManualViewport)
    const mapContainer = map.getContainer()
    const activePointers = new Set<number>()
    const trackPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      activePointers.add(event.pointerId)
      if (activePointers.size > 1) markManualViewport()
    }
    const trackPointerEnd = (event: PointerEvent) => activePointers.delete(event.pointerId)
    mapContainer.addEventListener('pointerdown', trackPointerDown, { passive: true })
    mapContainer.addEventListener('pointerup', trackPointerEnd, { passive: true })
    mapContainer.addEventListener('pointercancel', trackPointerEnd, { passive: true })
    mapContainer.addEventListener('wheel', markManualViewport, { passive: true })
    mapContainer.addEventListener('dblclick', markManualViewport, { passive: true })
    map.on('zoomend', () => setMapZoom(map.getZoom()))
    mapRef.current = map
    map.fitBounds(cityBounds, { padding: [14, 14], animate: false })
    window.setTimeout(() => {
      map.invalidateSize()
      automaticViewportRef.current = null
      setMapReadyToken((value) => value + 1)
    }, 0)

    return () => {
      mapContainer.removeEventListener('pointerdown', trackPointerDown)
      mapContainer.removeEventListener('pointerup', trackPointerEnd)
      mapContainer.removeEventListener('pointercancel', trackPointerEnd)
      mapContainer.removeEventListener('wheel', markManualViewport)
      mapContainer.removeEventListener('dblclick', markManualViewport)
      map.remove()
      mapRef.current = null
      baseTileLayerRef.current = null
      labelTileLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current)
    if (labelTileLayerRef.current) map.removeLayer(labelTileLayerRef.current)
    const tiles = MAP_TILES[mapSettings.variant]
    baseTileLayerRef.current = L.tileLayer(tiles.url, {
      subdomains: tiles.subdomains,
      maxZoom: tiles.maxZoom,
      attribution: tiles.attribution,
    }).addTo(map)
    labelTileLayerRef.current = tiles.labelsUrl
      ? L.tileLayer(tiles.labelsUrl, {
        pane: 'mapLabels',
        subdomains: tiles.subdomains,
        minZoom: 11,
        maxZoom: tiles.maxZoom,
        opacity: .9,
        attribution: tiles.attribution,
      }).addTo(map)
      : null
  }, [mapSettings.variant])

  useEffect(() => {
    if (!recenterToken || !mapRef.current) return
    manualViewportRef.current = false
    if (!isWithinPrishtinaMap(userLocation)) {
      mapRef.current.flyTo([PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng], 13, { duration: .45 })
      return
    }
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], mode === 'navigation' ? 17 : 16, { duration: .45 })
  }, [recenterToken, mode, userLocation.lat, userLocation.lng])

  useEffect(() => {
    const map = mapRef.current
    const parkingLayer = parkingLayerRef.current
    const routeLayer = routeLayerRef.current
    if (!map || !parkingLayer || !routeLayer) return
    parkingLayer.clearLayers()
    routeLayer.clearLayers()
    if (mode === 'home' && !destination && !route) automaticViewportRef.current = null

    const selectionFocused = mode === 'home' && Boolean(route || destination)

    visibleParkings.forEach((parking) => {
      if (!parking.geometry?.length && !mapSettings.showPointParking && mode === 'home') return
      const usefulOverviewPoint = parking.pricePerHour !== null || parking.free || Boolean(parking.availabilitySource)
      const detailedPointZoom = mapSettings.largePointMarkers ? (destination ? 13.5 : 14) : (destination ? 13.5 : 15)
      if (!parking.geometry?.length && mapZoom < detailedPointZoom && !usefulOverviewPoint) return
      const category = priceClass(parking.pricePerHour)
      const isSelected = selected.id === parking.id
      const rank = recommendationRanks?.get(parking.id)
      const restricted = ['customers', 'private', 'permit', 'no'].includes(parking.access)
      const color = areaColor(parking, mapSettings.parkingPalette)
      const areaFillOpacity = isSelected
        ? .72
        : selectionFocused
          ? mapZoom < 14 ? .2 : .3
        : mapSettings.emphasizeAreas
          ? mapZoom < 14 ? .42 : .56
          : mapZoom < 14 ? .2 : .34
      const interactiveLayers: L.Path[] = parking.geometry?.length
        ? parking.geometry.map((ring) => L.polygon(
          ring.map(({ lat, lng }) => [lat, lng] as L.LatLngTuple),
          {
            pane: 'parkingAreas',
            className: `parking-area parking-area--${category}${isSelected ? ' parking-area--selected' : ''}${restricted ? ' parking-area--restricted' : ''}`,
            color: isSelected ? '#0b3fd1' : color,
            weight: isSelected ? 4.5 : mapZoom < 14 ? 1.5 : 2.25,
            opacity: selectionFocused && !isSelected ? .68 : .95,
            fillColor: color,
            fillOpacity: areaFillOpacity,
            lineJoin: 'round',
          },
        ))
        : [L.circleMarker([parking.coordinates.lat, parking.coordinates.lng], {
          pane: 'parkingAreas',
          className: `parking-point parking-point--${category}${isSelected ? ' parking-point--selected' : ''}${restricted ? ' parking-point--restricted' : ''}`,
          radius: isSelected ? (mapSettings.largePointMarkers ? 11 : 8) : (mapSettings.largePointMarkers ? 8 : 5.5),
          color: isSelected ? '#0b3fd1' : '#fff',
          weight: isSelected ? 3.5 : mapSettings.largePointMarkers ? 2.25 : 1.5,
          fillColor: color,
          fillOpacity: restricted ? .45 : .9,
        })]

      interactiveLayers.forEach((layer) => {
        layer.bindPopup(createPopup(parking), { closeButton: false })
        const showParkingLabel = mode !== 'navigation' && mode !== 'walking' && mapZoom >= 17 && (isSelected || Boolean(rank && rank <= 3))
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

    if (mode === 'home' || mode === 'details') departures.forEach((departure) => {
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
        const routeEnd = mode !== 'walking' && route?.coordinates.length
          ? route.coordinates[route.coordinates.length - 1]
          : null
        const accessPoint = routeEnd ?? parkingAccessPoint(selected, destination.coordinates)
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
      const navigationWeight = mode === 'navigation' ? 7.5 : mode === 'walking' ? 6.5 : 6
      L.polyline(routePoints, { color: '#102a54', weight: navigationWeight + 7, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: '#ffffff', weight: navigationWeight + 3.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
      L.polyline(routePoints, { color: routeColor, weight: navigationWeight, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: mode === 'walking' ? '9 8' : undefined }).addTo(routeLayer)

      const firstPoint = route.coordinates[0]
      const lastPoint = route.coordinates[route.coordinates.length - 1]
      const followsLiveLocation = mode === 'navigation' && userLocationLive && isWithinPrishtinaMap(userLocation)
      const routeViewportKey = followsLiveLocation
        ? `follow:${userLocation.lat.toFixed(5)}:${userLocation.lng.toFixed(5)}`
        : mode === 'home' || mode === 'details'
          ? `route:${mode}:${selected.id}:${destination?.id ?? 'parking'}:${route.source}:${lastPoint?.lat.toFixed(5)}:${lastPoint?.lng.toFixed(5)}`
          : `route:${mode}:${selected.id}:${route.source}:${firstPoint?.lat.toFixed(5)}:${firstPoint?.lng.toFixed(5)}:${lastPoint?.lat.toFixed(5)}:${lastPoint?.lng.toFixed(5)}`
      if (!shouldFocusSelectedParking && !manualViewportRef.current && automaticViewportRef.current !== routeViewportKey) {
        automaticViewportRef.current = routeViewportKey
        if (followsLiveLocation) {
          map.setView([userLocation.lat, userLocation.lng], Math.max(17, Math.min(18, map.getZoom())), { animate: false })
        } else if (mode === 'navigation' || mode === 'walking') {
          map.fitBounds(L.latLngBounds(routePoints), {
            paddingTopLeft: [44, 120],
            paddingBottomRight: [44, 205],
            animate: false,
          })
        } else if (mode === 'home' && (!destination || destination.source === 'map')) {
          // Direct map and parking selections keep the exact viewport the user was inspecting.
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
      if (!manualViewportRef.current && automaticViewportRef.current !== destinationViewportKey) {
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
      const walkingStart = parkingAccessPoint(selected, destination.coordinates)
      const walkingConnection: L.LatLngExpression[] = [
        [walkingStart.lat, walkingStart.lng],
        [destination.coordinates.lat, destination.coordinates.lng],
      ]
      L.polyline(walkingConnection, { color: '#fff', weight: 7, opacity: .95 }).addTo(routeLayer)
      L.polyline(walkingConnection, { color: '#18b981', weight: 4, opacity: .95, dashArray: '8 7' }).addTo(routeLayer)
    }

    if (!shouldFocusSelectedParking && !manualViewportRef.current && mode === 'navigation' && !route) {
      const navigationViewportKey = `navigation:${selected.id}:${userLocation.lat.toFixed(5)}:${userLocation.lng.toFixed(5)}`
      if (automaticViewportRef.current !== navigationViewportKey) {
        automaticViewportRef.current = navigationViewportKey
        if (userLocationLive && isWithinPrishtinaMap(userLocation)) {
          map.setView([userLocation.lat, userLocation.lng], 17, { animate: false })
        } else {
          const entrance = parkingAccessPoint(selected, userLocation)
          map.fitBounds([[userLocation.lat, userLocation.lng], [entrance.lat, entrance.lng]], { padding: [70, 70], animate: false })
        }
      }
    } else if (!shouldFocusSelectedParking && mode === 'details' && !route) {
      const detailsViewportKey = `details:${selected.id}`
      if (automaticViewportRef.current !== detailsViewportKey) {
        automaticViewportRef.current = detailsViewportKey
        const entrance = parkingAccessPoint(selected, userLocation)
        map.setView([entrance.lat, entrance.lng], 15, { animate: false })
      }
    }
  }, [parkings, selected, mode, route, destination, walkMinutes, recommendationRanks, userLocation.lat, userLocation.lng, userLocationLive, userLocationAccuracy, mapZoom, mapReadyToken, departures, mapSettings.parkingPalette, mapSettings.emphasizeAreas, mapSettings.largePointMarkers, mapSettings.showPointParking])

  return (
    <div className={`map-canvas map-canvas--${mode} map-canvas--theme-${mapSettings.variant} map-canvas--palette-${mapSettings.parkingPalette} ${mapSettings.largeLabels ? 'map-canvas--large-labels' : ''} ${destination ? 'map-canvas--destination' : ''} ${pickingDestination ? 'map-canvas--picking' : ''}`} aria-label="Harta reale e parkingjeve në Prishtinë">
      <div ref={containerRef} className="leaflet-map" />
      {mode === 'home' && pickingDestination && <div className="map-pick-banner">Prek hartën për të vendosur destinacionin</div>}
      {mode === 'home' && destination && mapSettings.parkingPalette !== 'green' && (
        <div className="price-legend" aria-label="Kategoritë e çmimeve">
          <span className="price-legend__status">{destination ? `${parkings.length} parkingje • ${walkMinutes} min ecje` : loadStatus === 'loading' ? `${parkings.length} parkingje • duke rifreskuar` : loadStatus === 'live' ? `${parkings.length} zona parkingu` : `${parkings.length} parkingje OSM`}</span>
          {mapSettings.parkingPalette === 'price' ? (
            <>
              <span><i className="price-dot price-dot--free" />Falas</span>
              <span><i className="price-dot price-dot--low" />≤0.50€</span>
              <span><i className="price-dot price-dot--medium" />≤1€</span>
              <span><i className="price-dot price-dot--high" />&gt;1€</span>
              <span><i className="price-dot price-dot--unknown" />Pa çmim</span>
            </>
          ) : mapSettings.parkingPalette === 'operator' ? (
            <>
              <span><i className="price-dot price-dot--municipal" />Prishtina Parking</span>
              <span><i className="price-dot price-dot--parking" />OSM publik / rrugë</span>
              <span><i className="price-dot price-dot--private" />Privat</span>
            </>
          ) : (
            <>
              <span><i className="price-dot price-dot--parking" />Zonë parkingu</span>
              <span><i className="price-dot price-dot--restricted" />Qasje e kufizuar</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
