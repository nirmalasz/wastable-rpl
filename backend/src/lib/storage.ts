import { AwsClient } from 'aws4fetch';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env.js';

/**
 * Image storage with two drivers behind the same functions:
 *  - S3-compatible bucket (Cloudflare R2, AWS S3, ...) when S3_BUCKET is set: required on
 *    Heroku, whose dyno disk is wiped on every deploy and daily restart.
 *  - Local disk (UPLOAD_DIR, served by app.ts at /uploads) for development.
 * The API only ever hands out URLs produced here, so callers do not care which one runs.
 */
export const uploadDir = path.resolve(env.UPLOAD_DIR);

const s3 = env.S3_BUCKET
  ? {
      client: new AwsClient({
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        service: 's3',
        region: env.S3_REGION,
      }),
      objectUrl: (key: string) => `${env.S3_ENDPOINT!.replace(/\/+$/, '')}/${env.S3_BUCKET}/${key}`,
    }
  : null;

export const storageDriver: 's3' | 'local' = s3 ? 's3' : 'local';

const publicBase = (s3 ? env.S3_PUBLIC_URL! : env.PUBLIC_URL).replace(/\/+$/, '');

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
  const filename = `${randomUUID()}.${ext}`;
  if (s3) {
    const res = await s3.client.fetch(s3.objectUrl(`uploads/${filename}`), {
      method: 'PUT',
      body: new Uint8Array(buffer),
      headers: {
        'Content-Type': MIME[ext],
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${await res.text()}`);
  } else {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' });
  }
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

/** Reads one of our own uploads (used for AI photo extraction). */
export async function readOwnUpload(
  url: string,
): Promise<{ mimeType: string; data: Buffer } | null> {
  const filename = filenameFromUrl(url);
  if (!filename) return null;
  try {
    let data: Buffer;
    if (s3) {
      const res = await s3.client.fetch(s3.objectUrl(`uploads/${filename}`));
      if (!res.ok) return null;
      data = Buffer.from(await res.arrayBuffer());
    } else {
      data = await readFile(path.join(uploadDir, filename));
    }
    const ext = filename.split('.')[1] as Ext;
    return { mimeType: MIME[ext], data };
  } catch {
    return null;
  }
}
