import 'dotenv/config';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-before-deploying-123456';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Public base URL of this API, used to build upload URLs. */
    PUBLIC_URL: z.string().default('http://localhost:4000'),
    UPLOAD_DIR: z.string().default('uploads'),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    /** Number of reverse proxies in front of the API, so rate limits see the real client IP. */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: z.string().default('postgres://wastable:wastable@localhost:5432/wastable'),
    /** Unset or empty turns Redis off (AI cache/quota then live in process memory). */
    REDIS_URL: z.string().default(''),
    /** Apply pending database migrations when the server starts (one instance at a time). */
    MIGRATE_ON_START: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(10),

    /** Which LLM the AI agents use. Both have free tiers; see .env.example. */
    AI_PROVIDER: z.enum(['gemini', 'groq']).default('gemini'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-flash-latest'),
    GROQ_API_KEY: z.string().optional(),
    /** Smallest Groq model that still handles our JSON prompts reliably (see docs in .env.example). */
    GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
    /** Send photos to Groq; only turn on with a vision-capable GROQ_MODEL. */
    GROQ_VISION: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(20),

    /**
     * "off": new accounts are active immediately and no verification email is sent
     * (use until SMTP is set up). "on": users must verify their email before posting/claiming.
     */
    EMAIL_VERIFICATION: z.enum(['on', 'off']).default('off'),

    /** Pin -> address lookup. "nominatim" (OpenStreetMap, free) or "off". */
    GEOCODER: z.enum(['nominatim', 'off']).default('nominatim'),
    /** Nominatim's policy requires a User-Agent that identifies the app. */
    GEOCODER_USER_AGENT: z
      .string()
      .default('WASTABLE/0.1 (student project; https://github.com/nirmalasz/wastable-rpl)'),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('WASTABLE <no-reply@wastable.app>'),

    /**
     * S3-compatible photo storage (Cloudflare R2, AWS S3, Backblaze B2, ...). When S3_BUCKET is
     * empty, photos are written to UPLOAD_DIR on local disk, which Heroku wipes on every restart.
     */
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Public base URL the bucket is served from, e.g. https://pub-xxxx.r2.dev */
    S3_PUBLIC_URL: z.string().optional(),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.JWT_SECRET !== DEV_JWT_SECRET, {
    message: 'JWT_SECRET must be set in production',
    path: ['JWT_SECRET'],
  })
  .refine(
    (e) =>
      !e.S3_BUCKET ||
      Boolean(e.S3_ENDPOINT && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY && e.S3_PUBLIC_URL),
    {
      message:
        'S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL are required with S3_BUCKET',
      path: ['S3_BUCKET'],
    },
  );

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
/** Browsers send Origin without a trailing slash, so "https://x.app/" in config still matches. */
export const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
/** The web app's base URL, used for links in emails. */
export const webAppUrl = corsOrigins[0]!;
