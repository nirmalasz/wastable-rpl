import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { MAX_IMAGE_BYTES, saveImage } from '../../lib/storage.js';
import { requireAuth } from '../../middleware/auth.js';

/** Photo upload for profile pictures and listings. Body is the raw image (JPEG, PNG or WebP). */
export const uploadsRouter = Router();

const limiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'You are uploading too quickly. Please wait a few minutes.' },
});

uploadsRouter.post(
  '/uploads',
  requireAuth,
  limiter,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HttpError(415, 'Please choose a JPG, PNG or WebP photo (up to 5 MB).');
    }
    const saved = await saveImage(body);
    if (!saved) {
      throw new HttpError(415, 'That file does not look like a valid JPG, PNG or WebP photo.');
    }
    res.status(201).json({ url: saved.url });
  },
);
