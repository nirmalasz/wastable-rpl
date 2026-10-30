import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '../config/env.js';

const scrypt = (password: string, salt: Buffer, keylen: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// ---------- Minimal HS256 JWT (access, email-verification and password-reset tokens) ----------
const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');
const sign = (data: string) => createHmac('sha256', env.JWT_SECRET).update(data).digest();

export type TokenPurpose = 'access' | 'verify' | 'reset';

export interface TokenPayload {
  sub: string;
  purpose: TokenPurpose;
  /** Extra claim used to make reset links single-use (fingerprint of the old password hash). */
  fp?: string;
  iat: number;
  exp: number;
}

export function signToken(
  claims: Pick<TokenPayload, 'sub' | 'purpose' | 'fp'>,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds }));
  return `${header}.${body}.${b64url(sign(`${header}.${body}`))}`;
}

/** Returns the payload when the signature, expiry and purpose are valid, otherwise null. */
export function verifyToken(token: string, purpose: TokenPurpose): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${body}`);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (payload.purpose !== purpose || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
