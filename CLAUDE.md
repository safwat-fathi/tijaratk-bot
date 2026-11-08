# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets

- **NEVER access, read, open, cat, grep, or inspect `.env` files** (such as `.env`, `.env.local`, `.env.production`, or any `.env*` file containing real values).
- **NEVER print, expose, or log real environment variable values or secrets** (API keys, database credentials, tokens, secret keys) in tool outputs, chat responses, or logs.
- **ALWAYS reference `.env.example` or schema definitions** (e.g., `backend/src/config.ts`) when you need to understand expected environment variable names, types, or configuration structures.

## What this is

A NestJS (TypeScript) backend in `backend/` for classifying inbound Egyptian-Arabic/Arabizi merchant chat messages (e.g. WhatsApp-style order conversations) and extracting structured order data. See `message-classification-ai-engine-spec.md` for the full technical spec — it's the source of truth for the pipeline design, model tiers, and escalation policy. This repo is one piece of the broader TijaratkBot platform described in `TijaratkBot_SRD.md` / `TijaratkBot_PRD.md`; see the root `README.md` and `ROADMAP.md` for what's built vs. not. Webhook endpoints (`/webhooks/zernio`, plus legacy `/webhooks/meta` and `/webhooks/whatsapp/twilio`) ingest real customer messages, creating conversations and enqueuing jobs to a BullMQ worker to run the pipeline. Merchants connect Facebook/Instagram pages through the app (`GET /merchants/me/connect/:platform` -> Zernio OAuth -> `/zernio/callback`); Zernio is platform infrastructure (one account/profile, merchants never deal with it). Replies go out through `domains/messaging/deliver.ts` (Zernio for connected pages, Graph API only for legacy token-bearing rows). Merchants log in to the portal with an API key (`POST /auth/key-login`). Keys are derived from the merchant id and `JWT_SECRET_KEY` (`createMerchantApiKey`, nothing stored) and issued by the operator with `pnpm merchant:key` (list merchants, print a key, or `--new "<name>"`). The backend was ported from a FastAPI backend that has been removed; the migration log is `docs/nestjs-migration-decisions.md`.

## Commands (pnpm, inside `backend/`)

```bash
pnpm start:dev     # API with watch
pnpm worker:dev    # BullMQ worker (channel messages + nightly auto-learning)
pnpm test          # vitest; needs Postgres (empty, migrated test DB) + Redis
pnpm lint          # oxlint
pnpm typecheck
pnpm build
pnpm build && pnpm db:migrate    # apply pending drizzle/ migrations (fresh or existing DB)
```

Run a single test: `pnpm exec vitest run src/engine/pure.spec.ts -t "<name>"`

Requires Node, a running Redis (`redis://localhost:6379/0` by default), and Postgres with the `pgvector` extension (the baseline migration runs `CREATE EXTENSION IF NOT EXISTS vector`). Config comes from `.env` (see `backend/.env.example`) via `backend/src/config.ts`.

## Schema

`backend/src/db/schema.ts` (Drizzle) is the single source of truth; migrations are in `backend/drizzle/`. Change the schema with `pnpm exec drizzle-kit generate` and commit the new file. `pnpm db:migrate` (`src/scripts/migrate.ts`) records migrations already present in a database without history (production) before applying the rest, so run it everywhere.

## Architecture

### Two-stage AI routing

The core design idea (spec §3–§4) is a two-stage classification and extraction pipeline:

1. **Tier 0 — rule-based short-circuit** (`backend/src/engine/tier0-rules.ts`): regex match for greetings/spam/single-emoji reactions before any model call.
2. **DeepSeek v4 Flash via OpenRouter** (`backend/src/engine/gateway.ts`): sole LLM engine for classification and extraction. `prompts.ts` builds a system prompt composed of a shared dialect/persona/context preamble plus a per-task block. Low confidence, ambiguous extraction fields, repeated merchant corrections, or reasoning-heavy content flags the result for human review. Escalation triggers are centralized in `routing-policy.ts` (`evaluatePreflight` before calling the model, `evaluatePostflight` after) — each trigger returns a stable reason string that gets persisted to `Message.escalation_reason`, since that field is the primary signal for what to fine-tune next.

A separate embedding model (`BAAI/bge-m3`, via OpenRouter, 1024-dim) handles semantic search/clustering; it is not part of the chat-completion pipeline. `clients.ts` builds the OpenAI-SDK clients (DeepSeek, embeddings) for the OpenAI-compatible OpenRouter API.

Confidence is self-reported by the model as part of its constrained JSON output — normalized by the schemas in `schemas.ts` and checked against the threshold in `routing-policy.ts` — not logprob-derived. Structured output schemas (`IntentClassification`, `ExtractionResult`) are enforced via the JSON-schema response format supported by DeepSeek.

### Backend layout (`backend/src/`)

- `config.ts` — settings (no defaults for secrets, DB, models or provider URLs). `db/` — Drizzle client and `schema.ts`. `core/` — shared helpers and the `{ "detail": ... }` HTTP error shape.
- `engine/` — the classification/routing logic above, plus the AI action/tool layer: `action-validator.ts` (schema/ownership checks before execution), `tools/` (registry + tool handlers), and `action-resolution.ts` (LLM-driven tool selection, gated behind `Merchant.ai_tool_ordering_enabled`). Pure functions where possible (`tier0-rules`, `context-budget`, `routing-policy`) so they're unit-testable without a DB or network call; `pipeline.ts` wires them together and is the one place with DB/network side effects.
- `domains/<name>/` — a `service.ts` of plain functions taking a `Db`/transaction, plus a thin `*.controller.ts`. `cart`, `checkout`, `store-knowledge` are service-only: `cart`/`checkout` are reached exclusively through the AI tool layer, by design; `store-knowledge` is reached through the tool layer (for `ai_tool_ordering_enabled` merchants) and directly from `pipeline.ts`'s FAQ-answer fallback (for merchants without tool ordering). New API features follow this domain-folder pattern.
- `worker/` — BullMQ entry (`main.ts`) and job logic (`processor.ts`). `clustering/` — offline clustering job.

### Testing

- Integration tests (`backend/test/`) run each test in a rolled-back transaction against a disposable, empty, migrated Postgres (`TEST_DATABASE_URL`); AI is a scripted fake (`fakeAi`).
- `src/golden.spec.ts`, `src/engine/pure.spec.ts`, `src/engine/json-schema-parity.spec.ts`, `test/contract.spec.ts` check parity against the frozen specs in `docs/contract/` (`golden.json`, `openapi.json`). They are no longer regenerable; edit them by hand only when behavior intentionally changes.
- Test pure engine logic directly with no DB/network before reaching for fixtures.

## Known in-progress / not-yet-implemented

- The classification/extraction pipeline is wired into a request path (`POST /messages`). Channel/webhook ingestion (Facebook/Instagram/WhatsApp via Twilio) is implemented at `/webhooks/*`, which verifies signatures and enqueues messages to the worker for processing.
- Cart, checkout, and order-creation services exist (`domains/cart`, `domains/checkout`) and are reachable through the AI tool layer (`engine/tools/`) — but only for merchants with `Merchant.ai_tool_ordering_enabled=True`, which defaults off with no admin UI yet to flip it. Billing, delivery, and a multi-tenant dashboard layer are still not built — see the root `ROADMAP.md` for the full list against the PRD's MVP scope.
