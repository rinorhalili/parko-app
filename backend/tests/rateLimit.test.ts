import { expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRateLimit, sessionRateLimit } from '../src/middleware/rateLimit.js';

it('keeps session restoration separate from login limits and returns JSON on lockout', async () => {
  const app = express();
  app.post('/refresh', sessionRateLimit, (_req, res) => { res.sendStatus(401); });
  app.post('/login', authRateLimit, (_req, res) => { res.sendStatus(401); });
  for (let i = 0; i < 30; i++) expect((await request(app).post('/refresh')).status).toBe(401);
  expect((await request(app).post('/refresh')).status).toBe(429);
  for (let i = 0; i < 20; i++) expect((await request(app).post('/login')).status).toBe(401);
  const blocked = await request(app).post('/login');
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe('RATE_LIMITED');
  expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
});
