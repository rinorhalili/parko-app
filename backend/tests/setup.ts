process.env.NODE_ENV = "test";
process.env.PORT = "4010";
// Native development uses the host-mapped PostgreSQL port from docker-compose.yml.
process.env.DATABASE_URL = "postgresql://parko:parko-local-d34b18af62f047a996c5@127.0.0.1:5433/parko?schema=public";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-at-least-thirty-two-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-at-least-thirty-two-characters";
process.env.CORS_ORIGIN = "http://localhost:5173";
