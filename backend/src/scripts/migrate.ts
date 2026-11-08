// `pnpm db:migrate` (after `pnpm build`): apply pending drizzle migrations to ANY database.
// A database built before drizzle (production: old Alembic) has no migration history, so on first
// run we record the migrations whose effect is already there, then apply the rest.
import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { getSettings } from '../config.js';
import { createDb } from '../db/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const { db, pool } = createDb(getSettings().DB_URL);
const folder = 'drizzle';
const rows = async (q: string) => (await db.execute(sql.raw(q))).rows;

await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
await db.execute(sql`CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
if (!(await rows(`SELECT 1 FROM drizzle."__drizzle_migrations" LIMIT 1`)).length) {
  const hasTable = async (t: string) => (await rows(`SELECT to_regclass('public.${t}') AS r`))[0].r !== null;
  const hasWelcome = async () =>
    (await rows(`SELECT 1 FROM information_schema.columns WHERE table_name='merchants' AND column_name='welcome_message'`)).length > 0;
  // already-present effects, in migration order; stop at the first one that is not there
  const present = [await hasTable('merchants'), await hasTable('product_images'), (await hasTable('merchants')) && !(await hasWelcome())];
  const done = present.findIndex((p) => !p);
  const n = done === -1 ? present.length : done;
  for (const m of readMigrationFiles({ migrationsFolder: folder }).slice(0, n)) {
    await db.execute(sql`INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES (${m.hash}, ${m.folderMillis})`);
  }
  if (n) console.log(`existing database: recorded ${n} migration(s) as already applied`);
}
await migrate(db, { migrationsFolder: folder });
console.log('migrations up to date');
await pool.end();
