# Database

The Prisma schema defines users, sessions, parking spots, reports, reservations, posts, comments, reactions, reputation, notifications, favorites, zone alerts, moderation, and audit logs.

PostGIS is enabled for geography support. Current application code stores latitude and longitude directly and reserves `geoPoint` for spatial indexing and future proximity queries.
