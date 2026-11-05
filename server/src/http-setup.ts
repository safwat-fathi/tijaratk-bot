import type { NestExpressApplication } from '@nestjs/platform-express';
import { raw } from 'express';
import { getSettings } from './config.js';
import { DetailExceptionFilter } from './core/http.js';

/**
 * Shared by main.ts and the test harness. Create the app with `{ bodyParser: false }`.
 *
 * The Meta webhook gets the raw bytes (signature is over the exact body, and a malformed body must still be
 * acked with 200 + recorded, never answered with the body-parser's 400 - Meta retry-storms on non-2xx).
 */
export function configureHttp(app: NestExpressApplication): void {
  app.enableCors({ origin: getSettings().CORS_ORIGINS, credentials: true });
  app.useGlobalFilters(new DetailExceptionFilter());
  app.use(['/webhooks/meta', '/webhooks/zernio'], raw({ type: () => true, limit: '5mb' }));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
