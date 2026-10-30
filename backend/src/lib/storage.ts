import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env.js';

/**
 * Image storage. Local-disk driver for development and single-node hosting.
 * TODO(release): swap for Cloudflare R2 (S3 API) behind the same functions; the API only
 * ever hands out URLs produced here, so callers do not change.
 */
export const uploadDir = path.resolve(env.UPLOAD_DIR);
const publicBase = env.PUBLIC_URL.replace(/\/+$/, '');

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Ext = 'jpg' | 'png' | 'webp';
const MIME: Record<Ext, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Identifies an image by its magic bytes, so a renamed or spoofed file is rejected. */
export function detectImage(b: Buffer): Ext | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (
    b.length > 12 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    b.length > 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

export async function saveImage(buffer: Buffer): Promise<{ filename: string; url: string } | null> {
  const ext = detectImage(buffer);
  if (!ext) return null;
  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' });
  return { filename, url: `${publicBase}/uploads/${filename}` };
}

const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

function filenameFromUrl(url: string): string | null {
  const prefix = `${publicBase}/uploads/`;
  if (!url.startsWith(prefix)) return null;
  const filename = url.slice(prefix.length);
  return FILE_RE.test(filename) ? filename : null;
}

export const isOwnUploadUrl = (url: string) => filenameFromUrl(url) !== null;

/** Only photos uploaded through this API are accepted as listing or profile photos. */
export const uploadUrlSchema = z
  .string()
  .max(300)
  .refine(isOwnUploadUrl, 'Please add the photo with the upload button.');

/** Reads one of our own uploads from disk (used for AI photo extraction). */
export async function readOwnUpload(
  url: string,
): Promise<{ mimeType: string; data: Buffer } | null> {
  const filename = filenameFromUrl(url);
  if (!filename) return null;
  try {
    const data = await readFile(path.join(uploadDir, filename));
    const ext = filename.split('.')[1] as Ext;
    return { mimeType: MIME[ext], data };
  } catch {
    return null;
  }
}
