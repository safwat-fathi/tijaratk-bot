# TijaratkBot server (NestJS)

TypeScript port of `../backend` (FastAPI). Same Postgres, same Redis, same REST contract
(`../docs/contract/openapi.json`), so the Next.js frontend does not change. Migration log:
`../docs/nestjs-migration-decisions.md`.

```bash
pnpm install
cp .env.example .env     # JWT_SECRET_KEY and ENCRYPTION_KEY must match the Python backend while both run
pnpm start:dev           # API (PORT, default 8000)
pnpm worker:dev          # BullMQ worker: channel messages + nightly auto-learning (03:00)
pnpm test                # needs local Postgres (TEST_DATABASE_URL, default: local db `tijaratk_nest`) + Redis
pnpm typecheck && pnpm build
```

## Layout
- `src/domains/*` - one folder per domain: `service.ts` (plain functions taking a `Db`/transaction, like the Python
  `session` param) + a thin `*.controller.ts`.
- `src/engine/*` - classification/extraction pipeline, tool layer, postback router (port of `backend/app/engine`).
- `src/db/schema.ts` - Drizzle schema (introspected from the Alembic-built schema; Alembic is frozen).
- `src/worker/*` - BullMQ worker entry (`main.ts`) and job logic (`processor.ts`).
- `test/` - integration tests: every test runs in a rolled-back transaction; AI is a scripted fake (`fakeAi`).
- `src/golden.spec.ts`, `src/engine/pure.spec.ts` - assert parity with vectors generated from the Python code
  (`../docs/contract/gen_golden.py`): tier-0, routing policy, prompts, schemas, Fernet/JWT/HMAC/Twilio, money, clustering.

## Schema changes
Alembic is frozen at `41dfe2cad85a`. Change the schema with Drizzle (`pnpm exec drizzle-kit generate`) - never both.
