import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { Category } from '@/models/Category';

// Mock Category.find for offline integration tests
vi.spyOn(Category, 'find').mockReturnValue({
  sort: () => ({
    lean: () =>
      Promise.resolve([
        {
          _id: 'catering',
          name: 'Catering Service',
          icon: 'restaurant',
          providerIcon: 'utensils',
          color: '#E05A47',
          description: 'Wedding and event catering',
          startingPriceHint: 15000,
          highlights: ['Live cooking'],
          serviceScope: ['Food preparation'],
          eventTypes: ['Wedding'],
          services: ['Buffet'],
          sortOrder: 1,
          isActive: true,
        },
      ]),
  }),
} as any);

describe('App Routing & Cross-Cutting Middleware', () => {
  it('GET /api/v1/health returns 200 with status ok and IST timestamp', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('enforces X-App-Role header on auth endpoints (Decision D2)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobile: '9876543210' });

    // Missing role header on /auth/* returns 400 with ROLE_REQUIRED
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ROLE_REQUIRED');
  });

  it('formats master category data with per-role envelopes and casing (D3 & D4)', async () => {
    // 1. User app: raw camelCase array
    const userRes = await request(app)
      .get('/api/v1/categories')
      .set('X-App-Role', 'user');

    expect(userRes.status).toBe(200);
    expect(Array.isArray(userRes.body)).toBe(true);
    expect(userRes.body[0].name).toBe('Catering Service');

    // 2. Provider app: { success: true, data: [...] } in snake_case
    const provRes = await request(app)
      .get('/api/v1/categories')
      .set('X-App-Role', 'provider');

    expect(provRes.status).toBe(200);
    expect(provRes.body).toHaveProperty('success', true);
    expect(provRes.body).toHaveProperty('data');
    expect(Array.isArray(provRes.body.data)).toBe(true);
    expect(provRes.body.data[0]).toHaveProperty('title', 'Catering Service');
    expect(provRes.body.data[0]).toHaveProperty('icon', 'utensils');
  });

  it('returns role-appropriate 404 errors for unknown routes (D5)', async () => {
    // Provider 404 format
    const prov404 = await request(app)
      .get('/api/v1/unknown-endpoint')
      .set('X-App-Role', 'provider');

    expect(prov404.status).toBe(404);
    expect(prov404.body).toHaveProperty('success', false);
    expect(prov404.body).toHaveProperty('error');
    expect(prov404.body.error.code).toBe('NOT_FOUND');

    // User 404 format
    const user404 = await request(app)
      .get('/api/v1/unknown-endpoint')
      .set('X-App-Role', 'user');

    expect(user404.status).toBe(404);
    expect(user404.body).toHaveProperty('success', false);
    expect(user404.body).toHaveProperty('statusCode', 404);
    expect(user404.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('permits CORS access for test-three-mu-12 and aagarathirupthiprovider domains', async () => {
    // 1. User testing domain
    const userOriginRes = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://test-three-mu-12.vercel.app');

    expect(userOriginRes.status).toBe(200);
    expect(userOriginRes.headers['access-control-allow-origin']).toBe(
      'https://test-three-mu-12.vercel.app'
    );

    // 2. Provider testing domain
    const provOriginRes = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://aagarathirupthiprovider.vercel.app');

    expect(provOriginRes.status).toBe(200);
    expect(provOriginRes.headers['access-control-allow-origin']).toBe(
      'https://aagarathirupthiprovider.vercel.app'
    );

    // 3. Preflight OPTIONS request
    const optionsRes = await request(app)
      .options('/api/v1/categories')
      .set('Origin', 'https://test-three-mu-12.vercel.app')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'X-App-Role,Authorization');

    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers['access-control-allow-origin']).toBe(
      'https://test-three-mu-12.vercel.app'
    );
  });
});
