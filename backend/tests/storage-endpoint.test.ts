import { describe, expect, it } from 'vitest';
import { s3Endpoint } from '../src/lib/storage.js';

describe('s3Endpoint', () => {
  const account = 'https://abc123.r2.cloudflarestorage.com';

  it('keeps an account-level endpoint as is', () => {
    expect(s3Endpoint(account, 'wastable')).toBe(account);
    expect(s3Endpoint(`${account}/`, 'wastable')).toBe(account);
  });

  it('drops the bucket name that Cloudflare shows appended to the endpoint', () => {
    expect(s3Endpoint(`${account}/wastable`, 'wastable')).toBe(account);
    expect(s3Endpoint(`${account}/wastable/`, 'wastable')).toBe(account);
  });

  it('does not strip a path that only ends with the same letters', () => {
    expect(s3Endpoint(`${account}/mywastable`, 'wastable')).toBe(`${account}/mywastable`);
  });
});
