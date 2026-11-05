import { z } from 'zod';

// pydantic's bool parsing: case-insensitive true/false/1/0/yes/no/on/off/t/f/y/n
const TRUE = new Set(['true', '1', 'yes', 'on', 't', 'y']);
const FALSE = new Set(['false', '0', 'no', 'off', 'f', 'n']);
const bool = z.string().transform((v, ctx) => {
  const k = v.trim().toLowerCase();
  if (TRUE.has(k)) return true;
  if (FALSE.has(k)) return false;
  ctx.addIssue({ code: 'custom', message: 'must be a boolean (true/false/1/0/yes/no/on/off)' });
  return z.NEVER;
});
const csvOrJson = z.string().transform((v) => (v.trim().startsWith('[') ? (JSON.parse(v) as string[]) : v.split(',').map((s) => s.trim()).filter(Boolean)));

// Required vs optional: no defaults for secrets, DB, models or provider URLs
// (a missing value must stop startup, not silently fall back to a made-up one).
const schema = z
  .object({
    PROJECT_NAME: z.string().default('TijaratkBot'),
    VERSION: z.string().default('0.1.0'),
    PORT: z.coerce.number().default(8000),
    // Either DATABASE_URL, or the POSTGRES_* parts (same names as the Python backend)
    DATABASE_URL: z.string().optional(),
    POSTGRES_SERVER: z.string().optional(),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_PASSWORD: z.string().optional(),
    POSTGRES_DB: z.string().optional(),
    POSTGRES_PORT: z.coerce.number().default(5432),
    OPENROUTER_BASE_URL: z.string(),
    OPENROUTER_API_KEY: z.string(),
    OPENROUTER_PROVIDERS: csvOrJson.default(['DeepSeek', 'Fireworks', 'Together']),
    DEEPSEEK_MODEL: z.string(),
    EMBEDDING_BASE_URL: z.string(),
    EMBEDDING_API_KEY: z.string(),
    EMBEDDING_MODEL: z.string(),
    CLASSIFICATION_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.7),
    CONTEXT_HISTORY_TURNS: z.coerce.number().default(10),
    DEEPSEEK_TEMPERATURE: z.coerce.number().default(0.1),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().default(4096),
    AI_REQUEST_TIMEOUT_SECONDS: z.coerce.number().default(30),
    AI_MAX_RETRIES: z.coerce.number().default(2),
    CORS_ORIGINS: csvOrJson.default(['http://localhost:3000']),
    REDIS_URL: z.string().default('redis://localhost:6379/0'),
    META_APP_ID: z.string().default(''),
    META_APP_SECRET: z.string().default(''),
    META_VERIFY_TOKEN: z.string().default(''),
    ZERNIO_API_KEY: z.string().default(''),
    ZERNIO_PROFILE_ID: z.string().default(''),
    PUBLIC_API_URL: z.string().default(''),
    ZERNIO_RETURN_URL: z.string().default('http://localhost:3000/merchant/settings'),
    ZERNIO_WEBHOOK_SECRET: z.string().default(''),
    // Optional: id of our own Meta app saved in Zernio, so the consent screen says TijaratkBot instead of Zernio's app.
    ZERNIO_OAUTH_APP_ID: z.string().default(''),
    TWILIO_AUTH_TOKEN: z.string().default(''),
    TWILIO_WEBHOOK_URL: z.string().default(''),
    JWT_SECRET_KEY: z.string(),
    JWT_ALGORITHM: z.string().default('HS256'),
    JWT_EXPIRE_MINUTES: z.coerce.number().default(10080),
    // A human takeover (merchant reply or escalation) hands the AI back after this long with no human activity.
    HUMAN_TAKEOVER_IDLE_MINUTES: z.coerce.number().default(30),
    // Free plan (every merchant for now): the AI answers only the first N conversations (customers who wrote) each month.
    // ponytail: one global value; add Merchant.plan when paid plans exist.
    FREE_PLAN_MONTHLY_CONVERSATIONS: z.coerce.number().default(10),
    ENCRYPTION_KEY: z.string().default(''),
    DEMO_STOPGAP_MERCHANT_ID: z.string().default(''),
    RATE_LIMIT_ENABLED: bool.default(true),
    RATE_LIMIT_DEMO_MAX: z.coerce.number().default(10),
    RATE_LIMIT_DEMO_WINDOW: z.coerce.number().default(600),
    RATE_LIMIT_DEFAULT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_DEFAULT_WINDOW: z.coerce.number().default(60),
  })
  .superRefine((s, ctx) => {
    if (s.DATABASE_URL) return;
    for (const k of ['POSTGRES_SERVER', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'] as const) {
      if (s[k] === undefined) ctx.addIssue({ code: 'custom', path: [k], message: `Required (or set DATABASE_URL)` });
    }
  });

export type Settings = z.infer<typeof schema>;

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const r = schema.safeParse(env);
  if (r.success) return r.data;
  const problems = r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration - ${problems}`);
}

export const databaseUrl = (s: Settings) =>
  s.DATABASE_URL ??
  `postgresql://${encodeURIComponent(s.POSTGRES_USER!)}:${encodeURIComponent(s.POSTGRES_PASSWORD!)}@${s.POSTGRES_SERVER}:${s.POSTGRES_PORT}/${s.POSTGRES_DB}`;

let cached: Settings | undefined;
/** Process-wide settings (Python had a module-level `settings` too). */
export const getSettings = (): Settings => (cached ??= loadSettings());
export const setSettingsForTests = (s: Partial<Settings> | undefined) => {
  cached = s ? { ...loadSettings(process.env), ...s } : undefined;
};
