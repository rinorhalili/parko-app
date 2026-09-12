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

## Full application stack

The web app is a responsive PWA and is the supported mobile client: it installs on Android and iOS, uses the platform location permission, and has an offline shell. The API is an independent Express/Prisma service; PostgreSQL/PostGIS is the source of truth for parking, reports, community, moderation and notifications. Redis backs Socket.IO fan-out and BullMQ workers.

### Native mobile client

The Expo client lives in `mobile/` and uses the same API and JWT refresh flow as the web client. From that directory:

```bash
npm install
npm run start
npm run android
npm run ios
```

Set `expo.extra.apiBaseUrl` and `expo.extra.socketUrl` in `mobile/app.json` for a reachable API. Android emulators use `10.0.2.2`; physical devices require the development machine's LAN IP and an HTTPS URL for production. Native location permissions, SecureStore token persistence and notification permissions are configured in `mobile/app.json`.

Start a complete local stack:

```bash
cp backend/.env.docker.example backend/.env
# Set distinct JWT values and a non-default POSTGRES_PASSWORD.
# In Docker, DATABASE_URL must use host `postgres` and REDIS_URL host `redis`.
cd backend
docker compose up --build
```

The `migrate` service provisions the Prisma schema on an empty development database. Import the versioned OSM parking dataset after the stack is ready:

```bash
docker compose exec api npm run import:parking
```

For host-based development, run PostGIS and Redis, use `localhost` in `DATABASE_URL` and `REDIS_URL`, then run `npm run dev` and `npm run dev:worker` in `backend/`. Run `npm run dev` in the repository root for the web client. The Vite proxy routes `/api/v1` and Socket.IO to the API.

### Deployment and operations

Build and deploy the web bundle to any HTTPS static host. Deploy the API and worker as separate services from `backend/Dockerfile`, backed by managed Postgres with PostGIS and managed Redis. Configure `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the API's HTTPS origin before building web assets. Supply all backend variables from `backend/.env.example` through the host secret manager; refresh credentials are HTTP-only secure cookies, so web and API must be same-site or configured for the appropriate secure cookie policy.

Run the schema bootstrap once per release before API/worker rollout, then run `npm run import:parking` when refreshing the OSM dataset. Back up PostgreSQL daily with point-in-time recovery enabled; Redis is rebuildable queue/cache state. Use `/health` for API health checks and structured Pino logs for monitoring. Roll back by redeploying the prior immutable image; take a database backup before any schema change.

CI runs web type checks, tests, build, plus backend generation, build and tests on pull requests and `main`. The production release sequence is: build/test images, back up the database, provision schema, deploy API, deploy worker, deploy static web assets, then verify `/health`, login, a parking report, and Socket.IO delivery.

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

## Community backend (Supabase)

The map works without community data, but sign-in and live community reports require a Supabase project. Create a project, enable PostGIS, then run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL editor. The script creates the profile trigger, secure RLS policies, PostGIS indexes, moderated-content tables, reputation audit trail, and Realtime publications.

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY`. Never put a Supabase service-role key in the browser. In Supabase Auth, configure the application's URLs as redirect URLs and enable the desired email-confirmation policy.

Community availability reports are authenticated, rate-limited in PostgreSQL to one report per user and parking per minute, automatically expire, and award one auditable reputation point. Rows are synchronized through Supabase Realtime; RLS ensures that browsers only receive active public reports and their own private records.

Expected occupancy feed:

```json
{
  "source": "Prishtina Parking",
  "updatedAt": "2026-08-26T12:00:00Z",
  "parkings": [{ "id": "osm-way-852523325", "spaces": 42, "capacity": 705 }]
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

## Install on iPhone without the App Store

Deploy Parko over HTTPS, open its URL in Safari on the iPhone, then tap **Share → Add to Home Screen → Add**. Open it from the new Parko icon and approve **Precise Location** when prompted. The installed PWA works like an app while it is open; iOS does not permit continuous GPS tracking after a web app is closed.
