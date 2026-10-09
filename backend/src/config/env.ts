import 'dotenv/config';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-before-deploying-123456';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    DATABASE_URL: z.string().default('postgres://wastable:wastable@localhost:5432/wastable'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(10),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-flash-latest'),
    AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(20),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('WASTABLE <no-reply@wastable.app>'),

    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().default('wastable-images'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.JWT_SECRET !== DEV_JWT_SECRET, {
    message: 'JWT_SECRET must be set in production',
    path: ['JWT_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
