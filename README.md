# Parko

Mobile-first parking finder for Prishtina, based on OpenStreetMap geometry and verified optional operator data.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Desktop app

```bash
npm run dev:desktop
```

This launches the app in Electron with the Vite dev server and keeps the same `/api/*` proxy behavior.

For the packaged production build:

```bash
npm run desktop
```

This builds the app if needed, starts the local production server, and opens it in a desktop window.

## Production

```bash
npm run build
npm start
```

The dependency-free Node server serves `dist/`, proxies third-party APIs, and adds TTL caching. The default port is `4173`.

## Quality checks

```bash
npm run check
npm test
npm run build
```

Tests cover search relevance, verified occupancy validation, parking access-point selection, and local persistence.

## External configuration

Copy `.env.example` to `.env`. All integrations are optional:

- `PARKO_OCCUPANCY_URL`: verified municipal/operator occupancy feed.
- `PARKO_VALHALLA_URL`: pedestrian routing service.
- `PARKO_TELEMETRY_URL`: privacy-filtered error/event collector.
- `VITE_PUSH_PUBLIC_KEY` and `PARKO_PUSH_SUBSCRIPTION_URL`: Web Push reminders that can fire after the PWA is closed.

Expected occupancy feed:

```json
{
  "source": "Prishtina Parking",
  "updatedAt": "2026-08-26T12:00:00Z",
  "parkings": [
    { "id": "osm-way-852523325", "spaces": 42, "capacity": 705 }
  ]
}
```

Records older than 30 minutes, negative availability, and unknown parking IDs are ignored. Without this feed, the UI explicitly reports availability as unknown.

## Implemented capabilities

- Minimal Leaflet/CARTO map with zoom-aware street, area, and landmark labels
- About 340 mapped Prishtina parking objects from OpenStreetMap/Overpass
- Tap-anywhere destination selection with Nominatim reverse geocoding
- Walkable-radius recommendations that exclude restricted/private access
- On-demand, exact OSM parking footprints when a mapped parking pin is selected
- Verified OSM entrance nodes when mapped; otherwise a boundary-based access-point estimate
- GPS positioning and continuous updates after permission is granted
- OSRM driving routes and Valhalla pedestrian routes with honest fallbacks
- Direct Google Street View 360° link targeted at the selected parking entrance, with no API key required
- Honest separation between total capacity and unknown live availability
- Persistent filters, saved list, parked-car location, private note, and timer
- Service-worker reminders plus optional Web Push scheduling
- Privacy-filtered telemetry and a production proxy/cache

## Data responsibility

OpenStreetMap is used for location, access, capacity, and geometry where mapped. It is not treated as a live availability source. A verified operator feed is required before free-space counts are displayed as live.
