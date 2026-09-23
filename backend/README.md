# Community Parking Backend

Production-oriented Node.js API for Parko. It implements the backend architecture from the project prompt: REST API, JWT auth, Prisma/PostgreSQL/PostGIS, Redis, BullMQ jobs, Socket.IO realtime, RBAC, moderation, notifications and admin analytics.

## Requirements

- Node.js 22+
- PostgreSQL with PostGIS
- Redis
- Docker, optional

## Setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:validate
npm run dev
```

For the complete local stack, set unique passwords/secrets in `.env` first. Run these commands from `backend/` with Docker Desktop running:

```bash
docker compose -p parko-local up -d --build
npm run prisma:generate
npm run import:parking
```

The API runs at `http://127.0.0.1:4000` and initializes the local schema automatically. Start the website with `npm run dev` from the project root; Vite proxies `/api` to the API. Use `docker compose -p parko-local ps` to check the services and `docker compose -p parko-local stop` to stop them without removing database data. This is a fresh local database, so create a test account through the app; no demo accounts are installed.

For native scripts, `.env` needs `DATABASE_URL` pointing to `127.0.0.1:5433` and `REDIS_URL` to `127.0.0.1:6379`. Include the exact frontend origin in `CORS_ORIGIN` (for example `http://localhost:5173,http://127.0.0.1:5173`). Database, Redis, and API ports are bound to this computer only; phone testing should use Vite's LAN address and API proxy.

`npm run import:parking` imports the versioned OpenStreetMap snapshot, official municipal markers, and manually verified Google Maps parking points used by the web map. It is safe to run again: records retain their stable identifiers so map reports and backend records match. Availability remains unknown until reported. Do not use the demo seed for real parking data.

## API

All application endpoints live under `/api/v1`; `/api` is also supported for the documented, version-neutral contract.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `GET /parking`, `GET /parking/nearby`, `GET /parking/:id`, `POST /parking`
- `GET /parking/:id/availability` returns calculated capacity, active reservations and current status (cached in Redis for 30 seconds).
- `GET|PUT|DELETE /favorites` manages database-backed favorite parking/posts and zone availability alerts. When a user reports an available spot, alert subscribers for that zone receive a notification (at most once per 15 minutes per zone).
- `POST /reports/parking`, `GET /reports/parking`
- `GET /reservations/me`, `GET /reservations/parking/:parkingSpotId`, `POST /reservations`, `DELETE /reservations/:id`
- `GET /posts`, `POST /posts`, `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`
- `GET /posts/:postId/comments`, `POST /posts/:postId/comments`, `PATCH /comments/:id`, `DELETE /comments/:id`
- `POST|DELETE /posts/:id/reactions`, `POST|DELETE /comments/:id/reactions`
- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id`
- `POST /moderation/reports`, moderator review endpoints, admin user and analytics endpoints
- `GET /audit` is admin-only and paginated. `GET /health` reports API, PostgreSQL and Redis status without exposing configuration.

The refactored backend keeps HTTP concerns in `src/controllers`, data queries in `src/repositories`, domain operations in `src/services` and legacy-compatible domain modules in `src/modules`. The OpenAPI document is at `src/docs/openapi.yaml`.

Responses use:

```json
{ "success": true, "data": {} }
```

Errors use:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "..." } }
```

## Realtime

Socket.IO requires the JWT access token in `handshake.auth.token`. Clients can join:

- `parking:subscribe` with `{ "spotId": "...", "zone": "center" }`
- `community:subscribe`

Events emitted include `parking:reported`, `parking:updated`, `post:new`, `comment:new`, and `moderation:update`.

## Native clients

Browser sessions use an HTTP-only refresh cookie. Native clients send `X-Parko-Client: native` for register, login and refresh; the API then returns the rotating refresh token in the response body so it can be stored in the platform secure keystore. Never use this header for browser clients.

## Security

The server uses Helmet, CORS, request IDs, JSON size limits, rate limiting, password hashing with Argon2, short-lived JWT access tokens, refresh-token rotation and server-side role checks.

Never commit `.env`. Use long, unique JWT secrets in production.
