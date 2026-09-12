# Hosted deployment checklist

Parko can run without Docker on a hosted Node.js service. Provision a PostgreSQL database with PostGIS enabled and a managed Redis instance, then configure these environment variables in the hosting provider:

- `NODE_ENV=production`
- `DATABASE_URL` — pooled PostgreSQL connection URL with PostGIS enabled
- `REDIS_URL` — managed Redis connection URL
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — distinct, long random values
- `CORS_ORIGIN` — the exact web origin; multiple origins may be comma-separated
- `PORT` — supplied by the host when applicable
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` — VAPID key pair for browser push notifications
- `VAPID_SUBJECT` — contact URI for the VAPID identity (defaults to `mailto:support@parko.app`)
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret key; it is required in production

Before the first deploy, run `npx prisma db push`, `npm run seed`, and `npm run import:parking` against the hosted database. Deploy the API with `npm run build` followed by `npm start`. Set the web app's `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the API's HTTPS URL, then rebuild the web app.

Set the web app's `VITE_PUSH_PUBLIC_KEY` to exactly the same value as the backend `VAPID_PUBLIC_KEY`, then rebuild the web app.

Set the web app's `VITE_TURNSTILE_SITE_KEY` to the matching public Cloudflare Turnstile site key, then rebuild it. Register the deployed web hostname in Cloudflare; the API validates every login and registration token server-side using `TURNSTILE_SECRET_KEY`.

## Self-hosted Umami analytics

The Docker stack includes a separate `umami-db` PostgreSQL service and an Umami service exposed only on `127.0.0.1:${UMAMI_PORT:-3001}`. Set `UMAMI_DB_PASSWORD` and a long random `UMAMI_APP_SECRET` in `backend/.env`, then run `docker compose up -d umami-db umami`.

Publish Umami behind HTTPS through your reverse proxy, set `UMAMI_DOMAIN` in `index.html` to its public URL, and replace `UMAMI_WEBSITE_ID` after registering the Parko site in the Umami dashboard. On first login, use the documented default credentials `admin` / `umami`, then change that password immediately.

Umami is configured here as a cookie-free, self-hosted analytics service and no cookie-consent UI is included. Confirm your final analytics configuration and legal obligations for your deployment with appropriate counsel.

Do not use development secrets, wildcard CORS origins, or the default database password in production. The backend refuses default or duplicate JWT secrets when `NODE_ENV=production`.
