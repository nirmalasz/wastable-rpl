import type { RequestHandler } from 'express';

/**
 * Placeholder handler for endpoints that are planned but not built yet.
 * Replace each usage with a real controller as the feature is implemented.
 */
export const notImplemented =
  (feature: string): RequestHandler =>
  (req, res) => {
    res.status(501).json({
      error: 'Not implemented yet',
      feature,
      method: req.method,
      path: req.originalUrl,
    });
  };
