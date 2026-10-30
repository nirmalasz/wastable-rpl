import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env } from './config/env.js';
import { uploadDir } from './lib/storage.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './modules/index.js';

/** Builds the Express app without listening, so tests and other runtimes can reuse it. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a proxy/CDN, req.ip must come from X-Forwarded-For (only the configured hops are trusted).
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  // Uploaded photos are public, immutable files that the web app shows from another origin.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(uploadDir, { dotfiles: 'deny', index: false, maxAge: '7d', immutable: true }),
  );
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger }));
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
