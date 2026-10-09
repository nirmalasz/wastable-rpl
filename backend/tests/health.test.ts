import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('API basics', () => {
  const app = createApp();

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'wastable-api' });
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });

  it('planned endpoints return 501 until implemented', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(501);
  });
});
