import { describe, expect, it } from 'vitest';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../src/lib/crypto.js';

describe('crypto helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('signs tokens bound to a purpose', () => {
    const token = signToken({ sub: 'u1', purpose: 'verify' }, 60);
    expect(verifyToken(token, 'verify')?.sub).toBe('u1');
    expect(verifyToken(token, 'access')).toBeNull();
  });

  it('rejects tampered and expired tokens', () => {
    const token = signToken({ sub: 'u1', purpose: 'access' }, 60);
    expect(verifyToken(`${token}x`, 'access')).toBeNull();
    expect(verifyToken(signToken({ sub: 'u1', purpose: 'access' }, -10), 'access')).toBeNull();
  });
});
