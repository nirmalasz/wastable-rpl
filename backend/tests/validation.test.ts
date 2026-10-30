import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { detectImage } from '../src/lib/storage.js';

const app = createApp();

describe('friendly validation errors', () => {
  it('explains what to fix without leaking schema internals', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Rina', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBe('Email must be a valid email address.');
    expect(res.body.fields.password).toBe('Password must be at least 8 characters');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/zod|expected|received|invalid_type|schema/i);
  });

  it('reports missing fields as required', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBe('Email is required.');
  });

  it('hides internals for malformed bodies', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ nope');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('The request could not be read. Please try again.');
  });
});

describe('uploads', () => {
  it('requires login', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(20));
    expect(res.status).toBe(401);
  });

  it('detects images by content, not by name', () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    expect(detectImage(png)).toBe('png');
    expect(detectImage(Buffer.from('<svg onload=alert(1)></svg>'.padEnd(40)))).toBeNull();
    expect(detectImage(Buffer.from('MZ'.padEnd(40)))).toBeNull();
  });
});
