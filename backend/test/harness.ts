import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureHttp } from '../src/http-setup.js';
import { databaseUrl, getSettings, setSettingsForTests } from '../src/config.js';
import { DB, QUEUE, REDIS } from '../src/core/tokens.js';
import { type Db, createDb, schema } from '../src/db/index.js';
import { createAccessToken } from '../src/domains/auth/tokens.js';
import { type AiClient, setAiClientsForTests } from '../src/engine/clients.js';

export const { db: rootDb, pool } = createDb(databaseUrl(getSettings()));
export { schema };

class Rollback extends Error {}

/** Everything in `fn` happens in a transaction that is always rolled back (conftest.py db_session equivalent). */
export async function withRollback(fn: (db: Db) => Promise<void>): Promise<void> {
  try {
    await rootDb.transaction(async (tx) => {
      await fn(tx as unknown as Db);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

export const queued: { name: string; data: any; opts?: any }[] = [];
/** In-memory stand-in for the few Redis calls the HTTP app makes (the bot-sent marker). Cleared per app. */
export const fakeRedisKeys = new Set<string>();
const fakeRedis = {
  set: async (key: string) => (fakeRedisKeys.add(key), 'OK'),
  exists: async (key: string) => (fakeRedisKeys.has(key) ? 1 : 0),
};
const fakeQueue = { add: async (name: string, data: any, opts?: any) => void queued.push({ name, data, opts }) };

/** App wired to the test transaction; Redis/queue stubbed. */
export async function withApp(fn: (ctx: { app: INestApplication; db: Db; http: ReturnType<typeof supertest> }) => Promise<void>) {
  await withRollback(async (db) => {
    queued.length = 0;
    fakeRedisKeys.clear();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DB)
      .useValue(db)
      .overrideProvider(REDIS)
      .useValue(fakeRedis)
      .overrideProvider(QUEUE)
      .useValue(fakeQueue)
      .compile();
    const app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttp(app);
    await app.init();
    try {
      await fn({ app, db, http: supertest(app.getHttpServer()) });
    } finally {
      await app.close();
    }
  });
}

export async function makeMerchant(db: Db, o: Partial<typeof schema.merchants.$inferInsert> = {}) {
  const [m] = await db.insert(schema.merchants).values({ name: 'Test Merchant', ...o }).returning();
  return m;
}

export async function makeConversation(db: Db, merchantId: string, o: Partial<typeof schema.conversations.$inferInsert> = {}) {
  const [c] = await db
    .insert(schema.conversations)
    .values({ merchantId, customerRef: `cust-${randomUUID()}`, state: 'GATHERING', slots: {}, lastMessageAt: new Date(), ...o })
    .returning();
  return c;
}

export async function makeConnection(db: Db, merchantId: string, o: Partial<typeof schema.channelConnections.$inferInsert> = {}) {
  const [c] = await db
    .insert(schema.channelConnections)
    .values({ merchantId, channel: 'FACEBOOK', externalAccountId: `page-${randomUUID()}`, accountName: 'Test Page', ...o })
    .returning();
  return c;
}

export async function makeProduct(db: Db, merchantId: string, o: Partial<typeof schema.products.$inferInsert> = {}) {
  const [p] = await db.insert(schema.products).values({ merchantId, name: 'قميص', price: '100.00', ...o }).returning();
  return p;
}

export const authHeader = (merchantId: string) => ({ Authorization: `Bearer ${createAccessToken(getSettings(), merchantId)}` });

export { setSettingsForTests };

/** Scripted AI: responses are consumed in order; each is an object (JSON content) or an Error to throw. */
export function fakeAi(script: (any | Error)[] = [], embedding: number[] = unit(0)) {
  const calls: any[] = [];
  const llmClient: AiClient = {
    chat: {
      completions: {
        create: async (body: any) => {
          calls.push(body);
          const next = script.shift();
          if (next === undefined) throw new Error(`unscripted AI call: ${JSON.stringify(body.response_format?.json_schema?.name)}`);
          if (next instanceof Error) throw next;
          return { choices: [{ message: { content: JSON.stringify(next) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
        },
      },
    },
    embeddings: { create: async () => ({ data: [{ embedding }], usage: {} }) },
  };
  const emb: AiClient = {
    chat: llmClient.chat,
    embeddings: { create: async () => ({ data: [{ embedding }], usage: {} }) },
  };
  setAiClientsForTests({ llm: llmClient, embedding: emb });
  return { calls };
}

/** Unit vector along axis i of a 1024-dim space (distinct axes => cosine distance 1). */
export function unit(i: number): number[] {
  const v = new Array<number>(1024).fill(0);
  v[i] = 1;
  return v;
}

export const resetAi = () => setAiClientsForTests(undefined);
