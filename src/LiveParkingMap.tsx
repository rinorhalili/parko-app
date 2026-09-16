import { useEffect, useMemo, useRef, useState } from 'react'
import { parkingMarkerHtml } from './ui/parkingMarker'
import L from 'leaflet'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { PRISHTINA_CENTER, PRISHTINA_MAP_BOUNDS, USER_LOCATION, isWithinPrishtinaMap } from './parkingApi'
import { accessPointIsEstimated, parkingAccessPoint } from './parkingGeometry'
import type { Destination, DrivingRoute, MapMarkerFilter, MapSettings, MapVariant, Parking, ParkingLoadStatus, ParkingPalette } from './types'


type MapMode = 'home' | 'details' | 'navigation' | 'walking'
// Bundle the worker and its shared module for both Vite dev and production.
setWorkerUrl(maplibreWorkerUrl)
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY?.trim()
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

// Retain the original stored IDs so existing preferences still work.
const MAPTILER_STYLES: Record<MapVariant, string> = {
  standard: 'streets-v4',
  minimal: 'dataviz-v4-light',
  dark: 'streets-v4-dark',
  satellite: 'hybrid-v4',
}

const FALLBACK_TILES = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: 'Harta: <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
}

function priceClass(price: number | null) {
  if (price === null) return 'unknown'
  if (price === 0) return 'free'
  if (price <= 0.5) return 'low'
  if (price <= 1) return 'medium'
  return 'high'
}

function navigationPadding(map: L.Map) {
  const size = map.getSize()
  const wide = size.x >= 650 || (size.x > size.y && size.y <= 540)
  if (wide) return { paddingTopLeft: L.point(size.x >= 650 ? 410 : 330, 30), paddingBottomRight: L.point(55, 30) }
  const screen = map.getContainer().closest('.navigation-screen')
  const headerHeight = screen?.querySelector('.trip-header')?.getBoundingClientRect().height ?? 130
  const panelHeight = screen?.querySelector('.trip-panel')?.getBoundingClientRect().height ?? size.y * .52
  return { paddingTopLeft: L.point(35, headerHeight + 35), paddingBottomRight: L.point(55, panelHeight + 35) }
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
  markerFilter = 'all',
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
  markerFilter?: MapMarkerFilter
}) {
  // Availability is reflected on the parking cards; no locally fabricated
  // "leaving" pins are drawn on the map.
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseTileLayerRef = useRef<L.Layer | null>(null)
  const parkingLayerRef = useRef<L.LayerGroup | null>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
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
  const recenterPositionRef = useRef(userLocation)
  recenterPositionRef.current = userLocation
  const [mapZoom, setMapZoom] = useState(14)
  const [mapReadyToken, setMapReadyToken] = useState(0)
  const [basemapError, setBasemapError] = useState<string | null>(null)
  onSelectRef.current = onSelect
  onPickDestinationRef.current = onPickDestination
  onLongPressRef.current = onLongPress
  onManualMoveRef.current = onManualMove
  pickingDestinationRef.current = pickingDestination
  modeRef.current = mode
  const visibleParkings = useMemo(() => {
    const candidates = mode === 'navigation' || mode === 'walking' ? [selected] : parkings
    if (markerFilter === 'free') return candidates.filter((parking) => parking.pricePerHour === 0 && parking.pricingSource)
    if (markerFilter === 'paid') return candidates.filter((parking) => parking.pricePerHour !== null && parking.pricePerHour > 0 && parking.pricingSource)
    if (markerFilter === 'municipal') return candidates.filter((parking) => parking.municipalManaged)
    return candidates
  }, [markerFilter, mode, parkings, selected])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const cityBounds = L.latLngBounds(PRISHTINA_LEAFLET_BOUNDS)
    const map = L.map(containerRef.current, {
      center: [PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng],
      zoom: 13,
      minZoom: 12,
      maxZoom: 19,
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
    try {
      clusterGroupRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        disableClusteringAtZoom: 16,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => L.divIcon({
          html: `<div class="parking-cluster-bubble">${cluster.getChildCount()}</div>`,
          className: 'parking-cluster-icon',
          iconSize: L.point(44, 44),
        }),
      }).addTo(map)
    } catch (error) {
      console.error('Failed to initialize parking marker clustering', error)
      clusterGroupRef.current = null
    }
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
    // Start at a useful city scale; fitting the entire service boundary hid
    // individual parking areas on phones. Subsequent view changes stay user-led.
    map.setView([PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng], 14, { animate: false })
    const readyTimer = window.setTimeout(() => {
      map.invalidateSize()
      automaticViewportRef.current = null
      setMapReadyToken((value) => value + 1)
    }, 0)

    // Rotation, the on-screen keyboard and the desktop phone preview can resize
    // the container without a window resize. Redraw tiles without panning.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true })
    })
    resizeObserver.observe(mapContainer)

    return () => {
      window.clearTimeout(readyTimer)
      resizeObserver.disconnect()
      mapContainer.removeEventListener('pointerdown', trackPointerDown)
      mapContainer.removeEventListener('pointerup', trackPointerEnd)
      mapContainer.removeEventListener('pointercancel', trackPointerEnd)
      mapContainer.removeEventListener('wheel', markManualViewport)
      mapContainer.removeEventListener('dblclick', markManualViewport)
      map.remove()
      mapRef.current = null
      baseTileLayerRef.current = null
      clusterGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current)
    baseTileLayerRef.current = null
    setBasemapError(null)
    if (MAPTILER_KEY) {
      // Keep Leaflet's parking layers and interactions above the GL basemap.
      const layer = maplibreGL({
        style: `https://api.maptiler.com/maps/${MAPTILER_STYLES[mapSettings.variant]}/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`,
        attributionControl: {
          customAttribution: '&copy; <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        },
      })
      try {
        layer.addTo(map)
        baseTileLayerRef.current = layer
        const glMap = layer.getMaplibreMap()
        const onError = () => setBasemapError('Harta MapTiler nuk u ngarkua. Kontrollo lidhjen dhe çelësin API.')
        const onIdle = () => setBasemapError(null)
        glMap.on('error', onError)
        glMap.on('idle', onIdle)
        return () => {
          glMap.off('error', onError)
          glMap.off('idle', onIdle)
        }
      } catch {
        if (map.hasLayer(layer)) map.removeLayer(layer)
        setBasemapError('MapLibre nuk mund të hapet. Po shfaqet harta rezervë.')
      }
    } else {
      setBasemapError(null)
    }
    const tiles = FALLBACK_TILES
    baseTileLayerRef.current = L.tileLayer(tiles.url, {
      subdomains: tiles.subdomains,
      maxZoom: tiles.maxZoom,
      attribution: tiles.attribution,
    }).addTo(map)
  }, [mapSettings.variant])

  useEffect(() => {
    if (!recenterToken || !mapRef.current) return
    const userLocation = recenterPositionRef.current
    manualViewportRef.current = false
    if (!isWithinPrishtinaMap(userLocation)) {
      mapRef.current.flyTo([PRISHTINA_CENTER.lat, PRISHTINA_CENTER.lng], 13, { duration: .45 })
      return
    }
    if (mode === 'navigation') {
      const point = L.latLng(userLocation.lat, userLocation.lng)
      mapRef.current.fitBounds(L.latLngBounds(point, point), { ...navigationPadding(mapRef.current), maxZoom: 17, animate: false })
    } else mapRef.current.flyTo([userLocation.lat, userLocation.lng], 16, { duration: .45 })
  }, [recenterToken])

  useEffect(() => {
    const map = mapRef.current
    const parkingLayer = parkingLayerRef.current
    const clusterGroup = clusterGroupRef.current
    if (!map || !parkingLayer || !clusterGroup) return
    parkingLayer.clearLayers()
    clusterGroup.clearLayers()
    if (mode === 'home' && !destination && !route) automaticViewportRef.current = null

    const selectionFocused = mode === 'home' && Boolean(route || destination)

    let processedParkingCount = 0
    visibleParkings.forEach((parking) => {
      if (!parking.geometry?.length && !mapSettings.showPointParking && mode === 'home') return
      const usefulOverviewPoint = parking.pricePerHour !== null || parking.free || Boolean(parking.availabilitySource)
      const detailedPointZoom = mapSettings.largePointMarkers ? (destination ? 13.5 : 14) : (destination ? 13.5 : 15)
      if (!parking.geometry?.length && mapZoom < detailedPointZoom && !usefulOverviewPoint) return
      processedParkingCount += 1
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
      const interactiveLayers: Array<L.Path | L.Marker> = parking.geometry?.length
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
        : [L.marker([parking.coordinates.lat, parking.coordinates.lng], {
          pane: 'parkingAreas',
          icon: L.divIcon({
            className: '',
            html: parkingMarkerHtml({ color, category, selected: isSelected, restricted, large: mapSettings.largePointMarkers }),
            iconSize: L.point(44, 44),
            iconAnchor: L.point(22, 22),
          }),
        })]

      interactiveLayers.forEach((layer) => {
        layer.bindPopup(createPopup(parking), { closeButton: false })
        const showParkingLabel = mode !== 'navigation' && mode !== 'walking' && mapZoom >= 17 && (isSelected || Boolean(rank && rank <= 3))
        const label = document.createElement('span')
        label.textContent = `${rank ? `#${rank} · ` : ''}${parking.name} · ${priceLabel(parking.pricePerHour)}`
        layer.bindTooltip(label, {
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
        layer.addTo(parking.geometry?.length ? parkingLayer : clusterGroup)
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

    const totalRendered = parkingLayer.getLayers().length + clusterGroupRef.current!.getLayers().length
    if (totalRendered !== processedParkingCount) console.error(`Parking marker count mismatch: expected ${processedParkingCount}, rendered ${totalRendered}`)

  }, [visibleParkings, selected.id, mode, Boolean(route || destination), Boolean(destination), recommendationRanks, mapZoom, mapReadyToken, mapSettings.parkingPalette, mapSettings.emphasizeAreas, mapSettings.largePointMarkers, mapSettings.showPointParking])

  useEffect(() => {
    const map = mapRef.current
    const routeLayer = routeLayerRef.current
    if (!map || !routeLayer) return
    routeLayer.clearLayers()
    if (mode === 'navigation') {
      const entrance = parkingAccessPoint(selected, userLocation)
      L.marker([entrance.lat, entrance.lng], {
        icon: L.divIcon({ className: '', html: '<span class="trip-map-destination">P</span>', iconSize: [36, 36], iconAnchor: [18, 18] }),
        title: selected.name, interactive: false, zIndexOffset: 1000,
      }).addTo(routeLayer)
    }
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
          const point = L.latLng(userLocation.lat, userLocation.lng)
          map.fitBounds(L.latLngBounds(point, point), { ...navigationPadding(map), maxZoom: Math.max(17, Math.min(18, map.getZoom())), animate: false })
        } else if (mode === 'navigation' || mode === 'walking') {
          map.fitBounds(L.latLngBounds(routePoints), {
            paddingTopLeft: [44, 120],
            paddingBottomRight: [44, 205],
            ...(mode === 'navigation' ? navigationPadding(map) : {}),
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
          const point = L.latLng(userLocation.lat, userLocation.lng)
          map.fitBounds(L.latLngBounds(point, point), { ...navigationPadding(map), maxZoom: 17, animate: false })
        } else {
          const entrance = parkingAccessPoint(selected, userLocation)
          const point = L.latLng(entrance.lat, entrance.lng)
          map.fitBounds(L.latLngBounds(point, point), { ...navigationPadding(map), maxZoom: 16, animate: false })
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
  }, [parkings, selected, mode, route, destination, walkMinutes, recommendationRanks, userLocation.lat, userLocation.lng, userLocationLive, userLocationAccuracy, mapZoom, mapReadyToken, mapSettings.parkingPalette, mapSettings.emphasizeAreas, mapSettings.largePointMarkers, mapSettings.showPointParking])

  return (
    <div className={`map-canvas map-canvas--${mode} map-canvas--theme-${mapSettings.variant} map-canvas--palette-${mapSettings.parkingPalette} ${mapSettings.largeLabels ? 'map-canvas--large-labels' : ''} ${destination ? 'map-canvas--destination' : ''} ${pickingDestination ? 'map-canvas--picking' : ''}`} aria-label="Harta reale e parkingjeve në Prishtinë">
      <style>{`
        .parking-cluster-bubble { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 50%; background: var(--primary); color: white; box-shadow: 0 3px 10px rgba(16, 32, 51, .24); font-size: 13px; font-weight: 800; }
        .parking-point { display: block; box-sizing: border-box; width: var(--parking-point-size); height: var(--parking-point-size); border: var(--parking-point-border-width) solid var(--parking-point-border); border-radius: 50%; background: var(--parking-point-color); opacity: var(--parking-point-opacity); cursor: pointer; }
      `}</style>
      <div ref={containerRef} className="leaflet-map" />
      {basemapError && <div className="map-basemap-status" role="status">{basemapError}</div>}
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
