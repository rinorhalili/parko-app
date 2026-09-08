# Hosted deployment checklist

Parko can run without Docker on a hosted Node.js service. Provision a PostgreSQL database with PostGIS enabled and a managed Redis instance, then configure these environment variables in the hosting provider:

- `NODE_ENV=production`
- `DATABASE_URL` — pooled PostgreSQL connection URL with PostGIS enabled
- `REDIS_URL` — managed Redis connection URL
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — distinct, long random values
- `CORS_ORIGIN` — the exact web origin; multiple origins may be comma-separated
- `PORT` — supplied by the host when applicable

Before the first deploy, run `npx prisma db push`, `npm run seed`, and `npm run import:parking` against the hosted database. Deploy the API with `npm run build` followed by `npm start`. Set the web app's `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the API's HTTPS URL, then rebuild the web app.

Do not use development secrets, wildcard CORS origins, or the default database password in production. The backend refuses default or duplicate JWT secrets when `NODE_ENV=production`.
