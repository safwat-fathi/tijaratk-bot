import { userInfo } from 'node:os';

// Throwaway test configuration - never real secrets.
const key = Buffer.alloc(32, 7).toString('base64url');
process.env.DB_URL ??=
  process.env.TEST_DATABASE_URL ??
  `postgresql://${userInfo().username}@localhost:5432/tijaratk_nest`;
process.env.ENCRYPTION_KEY = key;
process.env.JWT_SECRET_KEY = 'test-jwt-secret-0123456789abcdef0123';
process.env.META_APP_SECRET = 'meta-app-secret-for-tests';
process.env.META_VERIFY_TOKEN = 'verify-me';
process.env.META_APP_ID = 'app-1';
process.env.TWILIO_AUTH_TOKEN = 'twilio-token-for-tests';
process.env.TWILIO_WEBHOOK_URL =
  'https://example.test/webhooks/whatsapp/twilio';
process.env.ZERNIO_API_KEY = 'zernio-key-for-tests';
process.env.ZERNIO_PROFILE_ID = 'profile-for-tests';
process.env.PUBLIC_API_URL = 'https://api.example.test';
process.env.ZERNIO_RETURN_URL = 'https://app.example.test/channels';
process.env.ZERNIO_WEBHOOK_SECRET = 'zernio-secret-for-tests';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.AI_MAX_RETRIES = '0';
process.env.OPENROUTER_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.LLM_MODEL = 'test-model';
process.env.EMBEDDING_BASE_URL = 'http://127.0.0.1:9/v1';
process.env.EMBEDDING_API_KEY = 'test-key';
process.env.EMBEDDING_MODEL = 'test-embed';

import { Logger } from '@nestjs/common';
if (!process.env.TEST_LOGS) Logger.overrideLogger(false);

// Tests assume a disposable, empty database (they count whole tables inside a rolled-back transaction).
// Fail fast and loudly instead of with confusing count mismatches - and never run against a real dev DB.
import { beforeAll } from 'vitest';
import pg from 'pg';

beforeAll(async () => {
  const client = new pg.Client({ connectionString: process.env.DB_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      'select count(*)::int as n from merchants',
    );
    if (rows[0].n !== 0) {
      throw new Error(
        `Test database ${new URL(process.env.DB_URL!).pathname} has ${rows[0].n} committed merchants. ` +
          'Point TEST_DATABASE_URL at an empty, disposable database (run `pnpm db:migrate` against it first).',
      );
    }
  } finally {
    await client.end();
  }
});
