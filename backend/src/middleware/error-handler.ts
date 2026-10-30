import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AiQuotaError } from '../ai/types.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { summarizeValidation } from '../lib/validation.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'We could not find what you were looking for.' });
};

const errorType = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'type' in err ? String(err.type) : undefined;

/**
 * Users get a clear reason they can act on (what to fix); developers get the full error in
 * the server log. Stack traces, SQL and schema details are never sent to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json(summarizeValidation(err));
    return;
  }
  if (err instanceof AiQuotaError) {
    res.status(429).json({ error: err.message });
    return;
  }
  const type = errorType(err);
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request could not be read. Please try again.' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'That upload is too large. Please choose a smaller file.' });
    return;
  }
  logger.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again later.' });
};
