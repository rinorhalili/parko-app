# Deployment

Backend production deployment can use `backend/docker-compose.production.yml` with PostgreSQL, Redis, API, worker, and Nginx services.

Required production secrets include:

- `DATABASE_URL` or PostgreSQL component variables
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- media scanning and object storage variables when uploads are enabled

Run migrations with `npm run db:deploy --prefix backend` before starting the API.
