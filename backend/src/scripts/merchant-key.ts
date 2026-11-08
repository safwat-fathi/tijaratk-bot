// Operator tool for merchant portal logins. Run from backend/ after `pnpm build`:
//   pnpm merchant:key                    list merchants
//   pnpm merchant:key "<name or id>"     print that merchant's API key
//   pnpm merchant:key --new "<name>"     create a merchant and print its API key
import { existsSync } from 'node:fs';
import { asc, eq, or } from 'drizzle-orm';
import { getSettings } from '../config.js';
import { createDb, schema } from '../db/index.js';
import { createMerchantApiKey } from '../domains/auth/tokens.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const s = getSettings();
const { db, pool } = createDb(s.DB_URL);
const t = schema.merchants;
const [first, ...rest] = process.argv.slice(2);
const name = rest.join(' ').trim();

if (first === '--new') {
  if (!name) throw new Error('usage: merchant:key --new "<name>"');
  const [created] = await db.insert(t).values({ name }).returning();
  console.log(createMerchantApiKey(s, created.id));
} else if (!first) {
  for (const m of await db.select().from(t).orderBy(asc(t.name))) console.log(`${m.id}  ${m.status}  ${m.name}`);
} else {
  const query = [first, ...rest].join(' ').trim();
  const found = await db.select().from(t).where(or(eq(t.id, query), eq(t.name, query)));
  if (found.length === 1) console.log(createMerchantApiKey(s, found[0].id));
  else {
    console.error(found.length ? `${found.length} merchants are named "${query}"; use the id` : `no merchant "${query}"`);
    process.exitCode = 1;
  }
}
await pool.end();
