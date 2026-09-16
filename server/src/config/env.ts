import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src/config -> server -> repository root
loadDotenv({ path: path.resolve(here, '../../../.env') });
loadDotenv({ path: path.resolve(here, '../../.env') });

const booleanFromEnv = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório.'),
    DATABASE_SSL: booleanFromEnv.default('false'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres.'),
    JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
    COOKIE_DOMAIN: z.string().optional(),

    // 'supabase' in production, 'local' for development without credentials.
    STORAGE_DRIVER: z.enum(['supabase', 'local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./uploads'),

    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('kenai-artworks'),

    SEED_ARTWORK_PATH: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: booleanFromEnv.default('false'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'supabase') {
      if (!env.SUPABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_URL'],
          message: 'SUPABASE_URL é obrigatório quando STORAGE_DRIVER=supabase.',
        });
      }
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_SERVICE_ROLE_KEY'],
          message: 'SUPABASE_SERVICE_ROLE_KEY é obrigatório quando STORAGE_DRIVER=supabase.',
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

function parseEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }
  return result.data;
}

export const env: AppEnv = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * Allowed browser origins. Supports a comma separated FRONTEND_URL so a single
 * backend can serve a preview deployment and production.
 */
export const allowedOrigins: string[] = env.FRONTEND_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
