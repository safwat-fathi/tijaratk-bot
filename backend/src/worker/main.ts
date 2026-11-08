import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { getSettings } from '../config.js';
import { CHANNEL_QUEUE_NAME, PROCESS_CHANNEL_MESSAGE } from '../core/tokens.js';
import { createDb } from '../db/index.js';
import { checkZernioHealth } from '../domains/channels/zernio-health.js';
import { processChannelMessage, runAutoLearning } from './processor.js';
import { Queue } from 'bullmq';

if (existsSync('.env')) process.loadEnvFile('.env');
const log = new Logger('worker');
const s = getSettings();
const { db, pool } = createDb(s.DB_URL);
const connection = new Redis(s.REDIS_URL, { maxRetriesPerRequest: null });
const lockRedis = new Redis(s.REDIS_URL);

// Nightly auto-learning at 03:00 (server local time)
const queue = new Queue(CHANNEL_QUEUE_NAME, { connection });
await queue.upsertJobScheduler('auto-learning', { pattern: '0 3 * * *' }, { name: 'run_auto_learning' });
await queue.upsertJobScheduler('zernio-health', { pattern: '0 * * * *' }, { name: 'check_zernio_health' });

const worker = new Worker(
  CHANNEL_QUEUE_NAME,
  async (job: Job) => {
    if (job.name === PROCESS_CHANNEL_MESSAGE) return processChannelMessage(db, lockRedis, job.data.messageId);
    if (job.name === 'run_auto_learning') return runAutoLearning(db);
    if (job.name === 'check_zernio_health') return checkZernioHealth(db);
    throw new Error(`unknown job ${job.name}`);
  },
  { connection },
);
worker.on('failed', (job, err) => log.error(`job_failed name=${job?.name} id=${job?.id} error=${err.message}`));
log.log('worker started');
void checkZernioHealth(db); // don't wait for the first hourly run after a deploy

const shutdown = async () => {
  await worker.close();
  await queue.close();
  connection.disconnect();
  lockRedis.disconnect();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
