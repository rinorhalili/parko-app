# API

Base paths:

- `/api/v1`
- `/api`

Main resources:

- `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`
- `GET /parking`, `GET /parking/:id`, `GET /parking/:id/availability`
- `POST /reports/parking`, `GET /reports/parking`
- `GET /posts`, `POST /posts`, `GET /posts/:id/comments`
- `GET /favorites`, `PUT /favorites/parking/:parkingSpotId`
- `GET /notifications`, `PATCH /notifications/:id/read`
- `GET /zones`, `GET /search?q=term`
- `GET /analytics/dashboard` for moderators and admins
