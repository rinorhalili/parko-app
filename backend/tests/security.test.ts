import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken, signRefreshToken } from '../src/utils/tokens.js';
import { effectiveStatus } from '../src/modules/parking/policy.js';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  parkingSpot: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  adminAction: { create: vi.fn() },
  auditLog: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../src/database/prisma.js', () => ({ prisma: db }));
import { adminRoutes } from '../src/modules/admin/routes.js';
import { userRoutes } from '../src/modules/users/routes.js';
import { createParkingReport } from '../src/modules/reports/service.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use(errorHandler);
const auth = (role: 'USER' | 'ADMIN' = 'ADMIN') => `Bearer ${signAccessToken({ id: 'actor', role })}`;

beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ id: 'actor', role: 'ADMIN', isActive: true });
  db.parkingSpot.findMany.mockResolvedValue([]);
  db.parkingSpot.count.mockResolvedValue(0);
  db.$transaction.mockImplementation((fn) => fn(db));
});

describe('backend access and admin management', () => {
  it('rejects unauthenticated admin access', async () => {
    expect((await request(app).get('/admin/parking')).status).toBe(401);
    expect(db.parkingSpot.findMany).not.toHaveBeenCalled();
  });
  it('checks the current database role instead of trusting an old admin token', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'actor', role: 'USER', isActive: true });
    expect((await request(app).get('/admin/parking').set('Authorization', auth())).status).toBe(403);
  });
  it('rejects suspended accounts with otherwise valid tokens', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'actor', role: 'ADMIN', isActive: false });
    expect((await request(app).get('/admin/parking').set('Authorization', auth())).status).toBe(401);
  });
  it('parses Express 5 query parameters and paginates the admin list', async () => {
    const response = await request(app).get('/admin/parking?page=2&q=Dardani&scope=all').set('Authorization', auth());
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ items: [], total: 0, page: 2, pageSize: 50 });
    expect(db.parkingSpot.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 50 });
  });
  it('rejects invalid pagination', async () => {
    expect((await request(app).get('/admin/parking?page=-1').set('Authorization', auth())).status).toBe(400);
  });
  it('approves a location without claiming it has available spaces', async () => {
    db.parkingSpot.update.mockResolvedValue({ id: 'spot' });
    const response = await request(app).patch('/admin/parking/spot').set('Authorization', auth()).send({ action: 'approve' });
    expect(response.status).toBe(200);
    expect(db.parkingSpot.update.mock.calls[0][0].data).toMatchObject({ status: 'UNKNOWN', reportedAt: null });
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it('requires a reason before disabling parking', async () => {
    const response = await request(app).patch('/admin/parking/spot').set('Authorization', auth()).send({ action: 'disable' });
    expect(response.status).toBe(400);
    expect(db.parkingSpot.update).not.toHaveBeenCalled();
  });
  it('does not select email or private account fields for public profiles', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ username: 'driver' });
    const response = await request(app).get('/users/550e8400-e29b-41d4-a716-446655440000');
    expect(response.status).toBe(200);
    const fields = db.user.findUniqueOrThrow.mock.calls[0][0].select;
    expect(fields.email).toBeUndefined();
    expect(fields.passwordHash).toBeUndefined();
    expect(fields.isActive).toBeUndefined();
  });
});

describe('truthful occupancy', () => {
  it('expires availability even if the worker has not run', () => {
    expect(effectiveStatus({ status: 'AVAILABLE', reportedAt: new Date(0) }, 31 * 60_000).status).toBe('UNKNOWN');
    expect(effectiveStatus({ status: 'AVAILABLE', reportedAt: null }).status).toBe('UNKNOWN');
    expect(effectiveStatus({ status: 'AVAILABLE', reportedAt: new Date() }).status).toBe('AVAILABLE');
  });
  it('preserves administrative restrictions', () => {
    expect(effectiveStatus({ status: 'TEMPORARILY_UNAVAILABLE', reportedAt: new Date(0) }).status).toBe('TEMPORARILY_UNAVAILABLE');
  });
  it('prevents reports from reopening a disabled location', async () => {
    db.parkingSpot.findUnique.mockResolvedValue({ id: 'spot', ownerId: null, status: 'TEMPORARILY_UNAVAILABLE' });
    await expect(createParkingReport('actor', { parkingSpotId: 'spot', status: 'AVAILABLE', latitude: 42.66, longitude: 21.16, confidence: 100 })).rejects.toThrow('not open for reports');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('issues unique refresh tokens even within the same second', () => {
    const user = { id: 'actor', role: 'USER' as const };
    expect(signRefreshToken(user)).not.toBe(signRefreshToken(user));
  });
});
