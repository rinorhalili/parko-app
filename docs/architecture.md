# Architecture

Parko is split into a Vite React web app, an Express API, a Prisma/PostgreSQL data layer, Socket.IO realtime channels, BullMQ background jobs, and an Expo mobile client.

The web app keeps the map experience in `src/App.tsx` and exposes newer page-level modules under `src/pages`. Shared HTTP access lives in `src/api`, while `src/context` owns browser auth and notification state.

The backend exposes `/api/v1` and `/api`, uses JWT access tokens with refresh cookies for the web client, and stores core entities in PostgreSQL with PostGIS enabled.
