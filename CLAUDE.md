# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets

- **NEVER access, read, open, cat, grep, or inspect `.env` files** (such as `.env`, `.env.local`, `.env.production`, or any `.env*` file containing real values).
- **NEVER print, expose, or log real environment variable values or secrets** (API keys, database credentials, tokens, secret keys) in tool outputs, chat responses, or logs.
- **ALWAYS reference `.env.example` or schema definitions** (e.g., `app/core/config.py`) when you need to understand expected environment variable names, types, or configuration structures.

## What this is

An async FastAPI backend for classifying inbound Egyptian-Arabic/Arabizi merchant chat messages (e.g. WhatsApp-style order conversations) and extracting structured order data. See `message-classification-ai-engine-spec.md` for the full technical spec — it's the source of truth for the pipeline design, model tiers, and escalation policy. This repo is one piece of the broader TijaratkBot platform described in `TijaratkBot_SRD.md` / `TijaratkBot_PRD.md`; see the root `README.md` and `ROADMAP.md` for what's built vs. not. Webhook endpoints (`/webhooks/meta` and `/webhooks/whatsapp/twilio`) ingest real customer messages, creating conversations and enqueuing jobs to an `arq` worker to run the pipeline, but outbound sending does not exist yet.

## Commands

```bash
make dev        # uvicorn --reload
make run         # uvicorn (no reload)
make worker      # uv run arq app.worker.WorkerSettings
make test        # uv run pytest
make lint        # uv run ruff check .
make format      # uv run ruff format .
make migrate     # alembic revision --autogenerate -m "Migration"
make upgrade     # alembic upgrade head
```

Run a single test: `uv run pytest tests/engine/test_routing_policy.py::test_escalates_on_low_confidence`

Requires Python 3.13, a running Redis instance (`redis://localhost:6379/0` by default), and a running Postgres with the `pgvector` extension available (the initial migration runs `CREATE EXTENSION IF NOT EXISTS vector`). Config comes from `.env` (see `.env.example`) via `app/core/config.py`'s pydantic-settings `Settings`.

## NestJS port (in progress)

`server/` is a TypeScript/NestJS port of `backend/` that runs against the same Postgres/Redis and serves the same REST contract (`docs/contract/openapi.json`). Strangler migration: both servers coexist until route groups are cut over. Migration log + deliberate differences: `docs/nestjs-migration-decisions.md`. Commands (pnpm): `pnpm start:dev`, `pnpm worker:dev`, `pnpm test`, `pnpm typecheck`, `pnpm build` inside `server/`. Alembic is frozen - schema changes go through Drizzle in `server/` once cutover starts; until then do not change the schema in only one place.

## Architecture

### Two-stage AI routing

The core design idea (spec §3–§4) is a two-stage classification and extraction pipeline:

1. **Tier 0 — rule-based short-circuit** (`app/engine/tier0_rules.py`): regex match for greetings/spam/single-emoji reactions before any model call.
2. **DeepSeek v4 Flash via OpenRouter** (`app/engine/gateway.py::deepseek_provider`): sole LLM engine for classification and extraction. `app/engine/prompts.py` builds a system prompt composed of a shared dialect/persona/context preamble plus a per-task block. Low confidence, ambiguous extraction fields, repeated merchant corrections, or reasoning-heavy content flags the result for human review. Escalation triggers are centralized in `app/engine/routing_policy.py` (`evaluate_preflight` before calling the model, `evaluate_postflight` after) — each trigger returns a stable reason string that gets persisted to `Message.escalation_reason`, since that field is the primary signal for what to fine-tune next.

A separate embedding model (`BAAI/bge-m3`, via OpenRouter, 1024-dim) handles semantic search/clustering; it is not part of the chat-completion pipeline. `app/engine/clients.py` builds two `AsyncOpenAI` clients (DeepSeek, embeddings) to communicate with the OpenAI-compatible OpenRouter API.

Confidence is self-reported by the model as part of its constrained JSON output — normalized by validators in `app/engine/schemas.py` and checked against the threshold in `app/engine/routing_policy.py::check_confidence_threshold` — not logprob-derived. Structured output schemas (`app/engine/schemas.py`: `IntentClassification`, `ExtractionResult`) are enforced via `json_schema_response_format` supported by DeepSeek.

### App layout

- `app/core/` — settings (`config.py`) and the async SQLAlchemy engine/session (`database.py`). `Base` lives here; models import it, not the other way around.
- `app/models/` — one file per ORM model (`merchant.py`, `conversation.py`, `message.py`, `product.py`, `order.py`, `order_item.py`, `cart.py`, `cart_item.py`, `ai_action.py`, `ai_usage_event.py`, `labeled_example.py`, `channel_connection.py`, `webhook_event.py`) plus shared `enums.py` and an id helper `_ids.py` (UUID4 strings, not autoincrement ints). `app/models/__init__.py` re-exports everything; `alembic/env.py` imports `app.models` to register tables on `Base.metadata` before autogenerate.
- `app/engine/` — the classification/routing logic described above, plus the AI action/tool layer: `action_validator.py` (schema/ownership checks before execution), `tools/` (registry + `catalog`/`cart`/`checkout`/`knowledge` handlers), and `action_resolution.py` (LLM-driven tool selection, gated behind `Merchant.ai_tool_ordering_enabled`). Pure functions where possible (`tier0_rules`, `context_budget`, `routing_policy`) so they're unit-testable without a DB or network call; `pipeline.py::process_message` wires them together and is the one function with DB/network side effects.
- `app/domains/<name>/` — feature-oriented routers + schemas (currently `health`, `messages`, `products`, `conversations`, `channels`). `cart`, `checkout`, `store_knowledge` also live here but are service-only — no router. `cart`/`checkout` are reached exclusively through the AI tool layer (`app/engine/tools/`), by design; `store_knowledge` is reached both through the tool layer (`app/engine/tools/knowledge.py`, for `ai_tool_ordering_enabled` merchants) and directly from `app/engine/pipeline.py`'s FAQ-answer fallback (for merchants without tool ordering enabled). New API features should follow this domain-folder pattern rather than a flat `routers/` directory.
- `app/api/router.py` — the single place that assembles domain routers (no version prefix — routes are mounted directly, e.g. `POST /messages`).

### Database/enum gotcha (Alembic)

Postgres enums shared across multiple tables (e.g. `ModelTier` used by both `messages` and `orders`) must be created once explicitly with the **postgres-specific** `sqlalchemy.dialects.postgresql.ENUM(..., create_type=False)`, then `.create(bind, checkfirst=True)` before the tables reference it. Passing `create_type=False` to the generic `sa.Enum` is silently ignored and will raise `DuplicateObjectError` on the second `create_table()`. See the comment block in `alembic/versions/2d17ac4bd857_add_classification_schema.py` for the full explanation — read it before writing a new migration that adds another shared enum.

### Testing

- `tests/conftest.py` provides a `db_session` fixture that wraps each test in an outer transaction + `SAVEPOINT` (`join_transaction_mode="create_savepoint"`), so code under test can call `session.commit()` without leaking rows into the real dev database; everything rolls back at teardown. Also provides `merchant`/`conversation` fixtures and a `mock_ai` fixture (respx) for mocking AI HTTP calls.
- `pytest-asyncio` is in `auto` mode (see `pyproject.toml`), so async test functions don't need an explicit marker.
- Engine-layer unit tests (`tests/engine/`) test the pure functions directly with no DB/network dependency — follow that pattern for new engine logic before reaching for fixtures.

## Known in-progress / not-yet-implemented

- `backend/scripts/seed.py` exists and seeds demo merchant data (`make seed`).
- The classification/extraction pipeline is wired into a request path (`POST /messages` → `app/engine/pipeline.py::process_message`). Channel/webhook ingestion (Facebook/Instagram/WhatsApp via Twilio) is implemented at `/webhooks/*`, which verifies signatures and enqueues messages to the `arq` worker (`make worker`) for processing.
- Cart, checkout, and order-creation services exist (`app/domains/cart`, `app/domains/checkout`) and are reachable through the AI tool layer (`app/engine/tools/`) — but only for merchants with `Merchant.ai_tool_ordering_enabled=True`, which defaults off with no admin UI yet to flip it. Billing, delivery, and a multi-tenant dashboard layer are still not built — see the root `ROADMAP.md` for the full list against the PRD's MVP scope.
