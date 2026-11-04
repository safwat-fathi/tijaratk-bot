import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { type Settings, databaseUrl, getSettings } from '../config.js';
import { type Db, createDb } from '../db/index.js';
import { CHANNEL_QUEUE_NAME, DB, QUEUE, REDIS, SETTINGS } from './tokens.js';

const pools = new WeakMap<object, pg.Pool>();

@Global()
@Module({
  providers: [
    { provide: SETTINGS, useFactory: () => getSettings() },
    {
      provide: DB,
      inject: [SETTINGS],
      useFactory: (s: Settings): Db => {
        const { db, pool } = createDb(databaseUrl(s));
        pools.set(db, pool);
        return db;
      },
    },
    {
      provide: REDIS,
      inject: [SETTINGS],
      useFactory: (s: Settings) => new Redis(s.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false }),
    },
    {
      provide: QUEUE,
      inject: [REDIS],
      useFactory: (redis: Redis) => new Queue(CHANNEL_QUEUE_NAME, { connection: redis }),
    },
  ],
  exports: [SETTINGS, DB, REDIS, QUEUE],
})
export class CoreModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown() {
    // Pools/queues are closed by the process exit; explicit close hooks live in main.ts.
  }
}
