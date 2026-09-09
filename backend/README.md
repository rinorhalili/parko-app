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

For a local database stack:

```bash
docker compose up postgres redis
npx prisma db push
npm run seed
npm run import:parking
npm run dev
```

`npm run import:parking` imports the versioned OpenStreetMap snapshot used by the web map. It is safe to run again: records retain their stable `osm-<kind>-<id>` identifiers so map reports and backend records match.

## API

All application endpoints live under `/api/v1`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `GET /parking`, `GET /parking/nearby`, `GET /parking/:id`, `POST /parking`
- `POST /reports/parking`, `GET /reports/parking`
- `GET /reservations/me`, `GET /reservations/parking/:parkingSpotId`, `POST /reservations`, `DELETE /reservations/:id`
- `GET /posts`, `POST /posts`, `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`
- `GET /posts/:postId/comments`, `POST /posts/:postId/comments`, `PATCH /comments/:id`, `DELETE /comments/:id`
- `POST|DELETE /posts/:id/reactions`, `POST|DELETE /comments/:id/reactions`
- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id`
- `POST /moderation/reports`, moderator review endpoints, admin user and analytics endpoints

Responses use:

```json
{ "success": true, "data": {} }
```

Errors use:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
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
