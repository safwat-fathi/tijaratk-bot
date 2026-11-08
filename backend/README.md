# TijaratkBot backend (NestJS)

TypeScript API backend and worker. Postgres + Redis, REST contract in `../docs/contract/openapi.json`
(a frozen spec the contract test checks against). Migration history: `../docs/nestjs-migration-decisions.md`.

```bash
pnpm install
cp .env.example .env
pnpm build && pnpm db:migrate   # any database: applies pending migrations
pnpm start:dev           # API (PORT, default 8000)
pnpm worker:dev          # BullMQ worker: channel messages + nightly auto-learning (03:00)
pnpm test                # needs local Postgres (TEST_DATABASE_URL, default: local db `tijaratk_nest`) + Redis
pnpm typecheck && pnpm build
```

## Layout
- `src/domains/*` - one folder per domain: `service.ts` (plain functions taking a `Db`/transaction) + a thin `*.controller.ts`.
- `src/engine/*` - classification/extraction pipeline, tool layer, postback router.
- `src/db/schema.ts` - Drizzle schema, the single source of truth. Migrations live in `drizzle/`.
- `src/worker/*` - BullMQ worker entry (`main.ts`) and job logic (`processor.ts`).
- `test/` - integration tests: every test runs in a rolled-back transaction; AI is a scripted fake (`fakeAi`).
- `src/golden.spec.ts`, `src/engine/pure.spec.ts` - assert parity with frozen vectors in `../docs/contract/golden.json`:
  tier-0, routing policy, prompts, schemas, Fernet/JWT/HMAC/Twilio, money, clustering.

## Schema changes
Edit `src/db/schema.ts`, then `pnpm exec drizzle-kit generate` and commit the new file in `drizzle/`.
`pnpm db:migrate` (needs `pnpm build` first) works on fresh and existing databases: a database without migration
history (production, built by Alembic) gets its already-present migrations recorded on first run, then the rest apply.
