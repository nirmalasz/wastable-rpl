import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

/** Validate request parts with zod. Parsed values are stored on res.locals.validated. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    res.locals.validated = {
      body: schemas.body?.parse(req.body),
      query: schemas.query?.parse(req.query),
      params: schemas.params?.parse(req.params),
    };
    next();
  };
