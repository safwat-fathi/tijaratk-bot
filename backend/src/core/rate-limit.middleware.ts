import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import type { Settings } from '../config.js';
import { REDIS, SETTINGS } from './tokens.js';

const SKIP = new Set(['/health', '/health/', '/docs', '/openapi.json']);

/** Fixed-window per-IP counter, same keys (`rl:{ip}:{window}`) as the Python middleware. Fails open. */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly log = new Logger('rate_limit');
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SETTINGS) private readonly s: Settings,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // originalUrl, not req.path: inside Nest's middleware mount `req.path` is not the full path.
    const path = req.originalUrl.split('?')[0];
    if (!this.s.RATE_LIMIT_ENABLED || SKIP.has(path)) return next();
    const ip = (req.headers['x-forwarded-for'] as string | undefined) || req.socket.remoteAddress || 'unknown';
    const demo = path.startsWith('/demo');
    const max = demo ? this.s.RATE_LIMIT_DEMO_MAX : this.s.RATE_LIMIT_DEFAULT_MAX;
    const window = demo ? this.s.RATE_LIMIT_DEMO_WINDOW : this.s.RATE_LIMIT_DEFAULT_WINDOW;
    const now = Math.floor(Date.now() / 1000);
    try {
      const key = `rl:${ip}:${Math.floor(now / window)}`;
      const results = await this.redis.multi().incr(key).expire(key, window * 2).exec();
      const count = Number(results?.[0]?.[1] ?? 0);
      if (count > max) {
        res.status(429).type('text/plain').set('Retry-After', String(window - (now % window))).send('Too Many Requests');
        return;
      }
    } catch (e) {
      this.log.error(`Rate limiting error: ${e}`);
    }
    next();
  }
}
