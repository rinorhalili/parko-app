# Security

Parko uses short-lived access tokens, HTTP-only refresh cookies for web sessions, password hashing, rate limiting, Helmet headers, request validation with Zod, and role-based authorization for moderator/admin areas.

Production must replace all example secrets, restrict `CORS_ORIGIN`, enable Turnstile or equivalent abuse protection for public auth, and configure media malware scanning before accepting uploads.
