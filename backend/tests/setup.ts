process.env.NODE_ENV = "test";
process.env.PORT = "4010";
process.env.DATABASE_URL = "postgresql://parko:parko@localhost:5432/parko?schema=public";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-length";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-length";
process.env.CORS_ORIGIN = "http://localhost:5173";
