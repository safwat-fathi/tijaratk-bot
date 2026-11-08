# Graph Report - tijaratk-bot  (2026-11-08)

## Corpus Check
- 196 files · ~367,832 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1605 nodes · 3136 edges · 122 communities (108 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9541e93d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- units.spec.ts
- registry.ts
- http-setup.ts
- TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md
- channels.controller.ts
- devDependencies
- index.ts
- products/service.ts
- devDependencies
- fetchProductsAction
- schema.ts
- compilerOptions
- Merchant
- harness.ts
- CurrentMerchant
- getBaseUrl
- messages.ts
- orders-client.tsx
- compilerOptions
- training-client.tsx
- delivery.controller.ts
- labeled-examples.controller.ts
- types.ts
- classification.ts
- pipeline.ts
- settings.json
- scripts
- dependencies
- TijaratkBot_SRD.md
- TijaratkBot_PRD.md
- getSettings
- DbOrTx
- login/actions.ts
- checkResponse
- test/zernio.spec.ts
- config.ts
- .updateStatus
- merchant/actions.ts
- ar.json
- tsconfig.build.json
- en.json
- generation.ts
- ZernioConnectController
- schemas.ts
- .takeover
- MerchantsController
- Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price
- Implementation decisions (phases 1-6, built 2026-11-04)
- TijaratkBot
- rate-limit.spec.ts
- .ingest
- README.md
- CLAUDE.md
- backend/package.json
- gateway-real-sdk.spec.ts
- app.module.ts
- store-knowledge-view.tsx
- .oxlintrc.json
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- AuthController
- nest-cli.json
- cpLen
- drizzle-orm
- action-resolution.ts
- @nestjs/core
- @nestjs/platform-express
- TijaratkBot backend (NestJS)
- usage/service.ts
- backend/AGENTS.md
- express
- @nestjs/common
- zod
- setup.ts
- conversations.ts
- TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)
- 33. Onboarding
- 44. Failure Handling
- AGENTS.md
- 15. AI Tool/Action Set
- 32. Merchant Dashboard Requirements
- 3. Technology Baseline
- frontend/README.md
- MVP Scope
- 45. Latency Targets
- 46. Testing Strategy
- 52. Recommended Initial Plan Configuration
- This is NOT the Next.js you know
- 2. Product Positioning
- 37. Future Roadmap
- 6. Core Product Modes
- TijaratkBot — Product Requirements Document (PRD)
- 4. Remediation plan (phases; each independently shippable)
- app/layout.tsx
- Merchant Dashboard Remediation
- use-local-storage.ts
- 83. Phase 1 Delivery Plan
- 57. API Design
- 100. Production Readiness Checklist
- 18. Phase 1 Scope --- Facebook Messenger
- 1. Executive Summary
- 5. Recommended Customer UX
- 73. Metrics
- 7. Why This Is Especially Important for 300 Products
- 80. Testing Strategy
- 6. The Hybrid UX Principle
- 82. UX Test Dataset
- 8. Recommended Customer Conversation Flow

## God Nodes (most connected - your core abstractions)
1. `Merchant` - 43 edges
2. `CurrentMerchant` - 43 edges
3. `getSettings()` - 35 edges
4. `getBaseUrl()` - 35 edges
5. `Db` - 32 edges
6. `processMessage()` - 32 edges
7. `notFound()` - 27 edges
8. `parse()` - 27 edges
9. `DbOrTx` - 25 edges
10. `checkResponse()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `TrainingClient()` --indirect_call--> `fetchExamplesAction()`  [INFERRED]
  frontend/app/merchant/training/training-client.tsx → frontend/app/merchant/actions.ts
- `settings()` --calls--> `loadSettings()`  [EXTRACTED]
  backend/test/rate-limit.spec.ts → backend/src/config.ts
- `sendZernioMessages()` --calls--> `getSettings()`  [EXTRACTED]
  backend/src/domains/messaging/deliver.ts → backend/src/config.ts
- `setProductImage()` --calls--> `getSettings()`  [EXTRACTED]
  backend/src/domains/products/service.ts → backend/src/config.ts
- `conversationUsage()` --calls--> `getSettings()`  [EXTRACTED]
  backend/src/domains/usage/service.ts → backend/src/config.ts

## Import Cycles
- None detected.

## Communities (122 total, 14 thin omitted)

### Community 0 - "units.spec.ts"
Cohesion: 0.05
Nodes (74): agglomerativeCosine(), clusterMessages(), EmbeddedMessage, fetchEmbeddedMessages(), labelCluster(), representativeMessages(), runClustering(), withConversationLock() (+66 more)

### Community 1 - "registry.ts"
Cohesion: 0.07
Nodes (49): centsToString(), lineTotalCents(), quantize2(), roundHalfEven(), roundScaledToCents(), scaledProduct(), toBigScaled(), toCents() (+41 more)

### Community 2 - "http-setup.ts"
Cohesion: 0.22
Nodes (6): AppModule, Module, DetailExceptionFilter, configureHttp(), app, Catch

### Community 3 - "TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md"
Cohesion: 0.02
Nodes (93): 101. What Not to Build in Phase 1, 102. Recommended Build Order, 103. Final Architecture, 104. The Most Important Engineering Rule, 105. Final Recommendation, 10. Product Detail UX, 11. Variant Resolution, 12. Cart UX (+85 more)

### Community 4 - "channels.controller.ts"
Cohesion: 0.09
Nodes (35): safeEqual(), createMerchantApiKey(), decodeAccessToken(), keyMac(), merchantIdFromApiKey(), ChannelsController, log, Controller (+27 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (39): devDependencies, drizzle-kit, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint (+31 more)

### Community 7 - "index.ts"
Cohesion: 0.11
Nodes (30): Settings, pools, ApiError, parse(), SKIP, CHANNEL_QUEUE_NAME, DB, QUEUE (+22 more)

### Community 8 - "products/service.ts"
Cohesion: 0.10
Nodes (33): iso(), num(), Product, ProductVariant, StoreKnowledge, getConversationMessages(), listConversations(), isOfferActive() (+25 more)

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, dependencies, @inlang/paraglide-js, @inlang/paraglide-next, lucide-react, next, nextjs-toploader (+33 more)

### Community 10 - "fetchProductsAction"
Cohesion: 0.28
Nodes (8): fetchKnowledgeAction(), fetchProductsAction(), MerchantDashboard(), PoliciesPage(), PoliciesClient(), ProductsPage(), ProductsClient(), useMerchantData()

### Community 11 - "schema.ts"
Cohesion: 0.06
Nodes (33): Fernet, encryptedString, getFernet(), aiActions, aiUsageEvents, bytea, cartItems, carts (+25 more)

### Community 12 - "compilerOptions"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+22 more)

### Community 13 - "Merchant"
Cohesion: 0.10
Nodes (23): Merchant, ProductCreate, ProductImagesController, ProductsController, ProductUpdate, Body, Controller, Delete (+15 more)

### Community 14 - "harness.ts"
Cohesion: 0.13
Nodes (19): setup(), contract, routes, { db: rootDb, pool }, fakeAi(), fakeQueue, fakeRedis, makeConnection() (+11 more)

### Community 15 - "CurrentMerchant"
Cohesion: 0.09
Nodes (23): notFound(), CurrentMerchant, ConversationsController, Body, Controller, Get, HttpCode, Inject (+15 more)

### Community 16 - "getBaseUrl"
Cohesion: 0.23
Nodes (14): connectFacebookAction(), updateAiEnabledAction(), updateAutoLearningAction(), CONNECT_ERRORS, SettingsPage(), SettingToggle(), SettingToggleProps, getIntents() (+6 more)

### Community 17 - "messages.ts"
Cohesion: 0.40
Nodes (4): MessageIngestRequest, MessageIngestResponse, OrderDetail, OrderLineItem

### Community 18 - "orders-client.tsx"
Cohesion: 0.18
Nodes (11): fetchOrdersAction(), ManualOrderResult, OrdersClient(), OrdersPage(), maxWidthClasses, Modal(), ModalProps, Order (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+14 more)

### Community 20 - "training-client.tsx"
Cohesion: 0.23
Nodes (9): createExampleAction(), deleteExampleAction(), updateExampleAction(), SOURCE_LABELS, TrainingClient(), handleAdd(), handleDelete(), handleUpdate() (+1 more)

### Community 21 - "delivery.controller.ts"
Cohesion: 0.11
Nodes (20): Create, DeliveryController, NOTE: unlike the Python router (which never committed - its writes were rolled…, Body, Controller, Delete, Get, HttpCode (+12 more)

### Community 22 - "labeled-examples.controller.ts"
Cohesion: 0.10
Nodes (17): Create, DEFAULT_INTENTS, extraction, intent, LabeledExamplesController, Body, Controller, Delete (+9 more)

### Community 23 - "types.ts"
Cohesion: 0.11
Nodes (20): Cart, CartItem, ChannelConnection, Conversation, DeliveryArea, HandoffReason, Merchant, Message (+12 more)

### Community 24 - "classification.ts"
Cohesion: 0.20
Nodes (19): ConvState, classifyMessage(), intentResponseSchema(), extractOrder(), CallUsage, deepseekProvider(), buildSystemPrompt(), classificationTaskBlock() (+11 more)

### Community 25 - "pipeline.ts"
Cohesion: 0.17
Nodes (20): COST_PER_1K_TOKENS, estimateCost(), findSimilarExamples(), addUsageEvent(), correctionCount(), DEFAULT_INTENTS, generateAiReply(), greetingFallback() (+12 more)

### Community 26 - "settings.json"
Cohesion: 0.20
Nodes (9): languageTags, modules, plugin.inlang.messageFormat, pathPattern, $schema, sourceLanguageTag, ar, en (+1 more)

### Community 27 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:migrate, deploy, format, lint, merchant:key, start (+11 more)

### Community 28 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, bullmq, ioredis, jsonwebtoken, openai, pg, reflect-metadata, rxjs (+9 more)

### Community 29 - "TijaratkBot_SRD.md"
Cohesion: 0.04
Nodes (53): 10. Product Search, 11. Conversation, 12. Conversation State, 13. Message, 14. AI Orchestrator, 15. AI Gateway, 16. L0 Router, 17. L1 Nile-Chat Service (+45 more)

### Community 30 - "TijaratkBot_PRD.md"
Cohesion: 0.06
Nodes (31): 10. L0 — Deterministic Layer, 11. L1 — Nile-Chat 4B, 12. L2 — DeepSeek V4 Flash, 13. L3 — Human Escalation, 14. AI Action Architecture, 16. Catalog Retrieval, 17. Egyptian Arabic and Arabizi Normalization, 18. Conversation State (+23 more)

### Community 31 - "getSettings"
Cohesion: 0.30
Nodes (16): getSettings(), AiClient, build(), getDeepseekClient(), getEmbeddingClient(), isApiError(), log, parseJsonContent() (+8 more)

### Community 32 - "DbOrTx"
Cohesion: 0.19
Nodes (15): DbOrTx, LabeledExample, createExample(), embeddingFor(), LabeledExampleRead, listExamples(), log, toRead() (+7 more)

### Community 33 - "login/actions.ts"
Cohesion: 0.13
Nodes (10): loginWithKeyAction(), logoutAction(), ERRORS, navigation, SidebarClient(), SESSION_COOKIES, { Link, useRouter, usePathname, redirect, permanentRedirect }, middleware (+2 more)

### Community 34 - "checkResponse"
Cohesion: 0.25
Nodes (17): checkResponse(), createManualOrderAction(), createProductAction(), deleteProductAction(), deleteProductImageAction(), fetchExamplesAction(), fetchMessagesAction(), getAuthHeaders() (+9 more)

### Community 35 - "test/zernio.spec.ts"
Cohesion: 0.12
Nodes (8): Body, HttpCode, Post, createAccessToken(), authHeader(), fakeRedisKeys, callback(), Http

### Community 36 - "config.ts"
Cohesion: 0.15
Nodes (12): bool, csvOrJson, databaseUrl(), FALSE, schema, TRUE, createDb(), { db, pool } (+4 more)

### Community 37 - ".updateStatus"
Cohesion: 0.15
Nodes (12): CheckoutController, loadItems(), toOrderRead(), Body, Controller, Get, HttpCode, Inject (+4 more)

### Community 38 - "merchant/actions.ts"
Cohesion: 0.25
Nodes (11): ConversationRecord, fetchConversationsAction(), MessageRecord, returnToAiAction(), sendManualReplyAction(), takeoverConversationAction(), ConversationsClient(), ConversationsPage() (+3 more)

### Community 39 - "ar.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 40 - "tsconfig.build.json"
Cohesion: 0.17
Nodes (11): compilerOptions, rootDir, exclude, extends, include, node_modules, dist, **/*spec.ts (+3 more)

### Community 41 - "en.json"
Cohesion: 0.12
Nodes (15): demo_catalog_aka, demo_catalog_egp, demo_catalog_empty, demo_catalog_matched, demo_catalog_no_options, demo_catalog_title, demo_knowledge_empty, demo_knowledge_keywords (+7 more)

### Community 42 - "generation.ts"
Cohesion: 0.23
Nodes (11): pyJsonDumps(), buildContextPrompt(), HistoryMessage, PromptExample, PromptMode, truthy(), generateReply(), renderHistory() (+3 more)

### Community 43 - "ZernioConnectController"
Cohesion: 0.24
Nodes (7): Controller, Get, Param, Query, Res, UseGuards, ZernioConnectController

### Community 44 - "schemas.ts"
Cohesion: 0.22
Nodes (10): J, objectSig(), ours(), sig(), confidence, ExtractionBase, GeneratedReply, IntentClassification (+2 more)

### Community 45 - ".takeover"
Cohesion: 0.25
Nodes (8): HandoffController, Body, Controller, HttpCode, Inject, Param, Post, UseGuards

### Community 46 - "MerchantsController"
Cohesion: 0.20
Nodes (8): MerchantsController, read(), Body, Controller, Get, Inject, Patch, UseGuards

### Community 47 - "Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price"
Cohesion: 0.18
Nodes (10): AI-engineering review, Context, Decisions built in (override at approval), Fix: bot answers "هتأكد من السعر وأرجعلك" instead of quoting the catalog price, Manual steps after merge, Recommended changes (TDD: write W0 first, watch it fail, then W1-W5), Reply to forward to the merchant (Arabic, edit freely), Verification (+2 more)

### Community 48 - "Implementation decisions (phases 1-6, built 2026-11-04)"
Cohesion: 0.25
Nodes (7): Architecture, Decisions, Deliberate behavior differences from Python (all bug-fixes or hardening), Format, Implementation decisions (phases 1-6, built 2026-11-04), Known gaps / follow-ups, NestJS migration: decision log

### Community 49 - "TijaratkBot"
Cohesion: 0.18
Nodes (11): Architecture, Backend, Documentation, Frontend, Getting started, Prerequisites, Project structure, Status (+3 more)

### Community 50 - "rate-limit.spec.ts"
Cohesion: 0.24
Nodes (6): loadSettings(), RateLimitMiddleware, Inject, Injectable, hit(), settings()

### Community 51 - ".ingest"
Cohesion: 0.20
Nodes (8): ingestInTransaction(), MessagesController, Body, Controller, Inject, Post, Res, UseGuards

### Community 52 - "README.md"
Cohesion: 0.20
Nodes (6): Explicitly out of scope for now (PRD §5), Near-term — MVP gap-closers, Now — built today, Phase 2 (per PRD §37), Phase 3 (per PRD §37), Roadmap

### Community 53 - "CLAUDE.md"
Cohesion: 0.20
Nodes (9): Architecture, Backend layout (`backend/src/`), Commands (pnpm, inside `backend/`), ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, Known in-progress / not-yet-implemented, Schema, Testing, Two-stage AI routing (+1 more)

### Community 54 - "backend/package.json"
Cohesion: 0.22
Nodes (8): author, description, license, name, packageManager, private, type, version

### Community 55 - "gateway-real-sdk.spec.ts"
Cohesion: 0.28
Nodes (4): setSettingsForTests(), AICallError, setAiClientsForTests(), against()

### Community 56 - "app.module.ts"
Cohesion: 0.17
Nodes (8): CoreModule, Module, HealthController, RootController, Controller, Get, Inject, Global

### Community 58 - "store-knowledge-view.tsx"
Cohesion: 0.39
Nodes (6): createKnowledgeAction(), deleteKnowledgeAction(), updateKnowledgeAction(), KNOWLEDGE_TYPES, StoreKnowledgeView(), StoreKnowledge

### Community 59 - ".oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 63 - "AuthController"
Cohesion: 0.29
Nodes (5): AuthController, Controller, Get, Inject, UseGuards

### Community 64 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 65 - "cpLen"
Cohesion: 0.47
Nodes (5): cpLen(), stripChars(), search(), matchTier0(), SPAM_SUB

### Community 69 - "action-resolution.ts"
Cohesion: 0.47
Nodes (5): renderResponse(), resolveAction(), stripInternal(), ACTION_TASK_BLOCK, StoreFacts

### Community 72 - "TijaratkBot backend (NestJS)"
Cohesion: 0.50
Nodes (3): Layout, Schema changes, TijaratkBot backend (NestJS)

### Community 73 - "usage/service.ts"
Cohesion: 0.83
Nodes (3): conversationsThisMonth(), conversationUsage(), isOverConversationLimit()

### Community 102 - "TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)"
Cohesion: 0.18
Nodes (11): 1.1 Retired Model (formerly Tier 1): MBZUAI-Paris/Nile-Chat-4B, 1.2 Sole LLM Tier: DeepSeek v4 Flash (via OpenRouter API), 1.3 Embedding Model: BAAI/bge-m3 (Self-Hosted Multilingual), 1. Model References, 2. Data Model, 3. Pipeline, 4. Review-Flagging Policy, 5. Embeddings (+3 more)

### Community 109 - "33. Onboarding"
Cohesion: 0.29
Nodes (7): 33. Onboarding, Step 1, Step 2, Step 3, Step 4, Step 5, Step 6

### Community 111 - "44. Failure Handling"
Cohesion: 0.33
Nodes (6): 44. Failure Handling, AI produces invalid JSON, Both unavailable, Commerce action fails, DeepSeek unavailable, Nile-Chat unavailable

### Community 112 - "AGENTS.md"
Cohesion: 0.29
Nodes (5): ✍️ Content & Blog Author Rule: TijaratkBot Team Only, 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, General Guidelines, graphify

### Community 113 - "15. AI Tool/Action Set"
Cohesion: 0.40
Nodes (5): 15. AI Tool/Action Set, Cart, Catalog, Checkout, Knowledge

### Community 114 - "32. Merchant Dashboard Requirements"
Cohesion: 0.40
Nodes (5): 32. Merchant Dashboard Requirements, AI, Conversations, Orders, Products

### Community 115 - "3. Technology Baseline"
Cohesion: 0.40
Nodes (5): 3. Technology Baseline, AI, Backend, Frontend, Infrastructure

### Community 116 - "frontend/README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 117 - "MVP Scope"
Cohesion: 0.50
Nodes (4): 4. Product Scope, Customer, Merchant, MVP Scope

### Community 118 - "45. Latency Targets"
Cohesion: 0.50
Nodes (4): 45. Latency Targets, L0, L1, L2

### Community 119 - "46. Testing Strategy"
Cohesion: 0.50
Nodes (4): 46. Testing Strategy, AI tests, Integration tests, Unit tests

### Community 120 - "52. Recommended Initial Plan Configuration"
Cohesion: 0.50
Nodes (4): 52. Recommended Initial Plan Configuration, Growth, Pro, Starter

### Community 122 - "This is NOT the Next.js you know"
Cohesion: 0.40
Nodes (4): 🚨 CRITICAL RULE: Mandatory Frontend & Backend Lint Checks, ⚡ CRITICAL RULE: Server-Side Data Fetching & Page Architecture, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, This is NOT the Next.js you know

### Community 123 - "2. Product Positioning"
Cohesion: 0.67
Nodes (3): 2. Product Positioning, AI promise, Core promise

### Community 124 - "37. Future Roadmap"
Cohesion: 0.67
Nodes (3): 37. Future Roadmap, Phase 2, Phase 3

### Community 125 - "6. Core Product Modes"
Cohesion: 0.67
Nodes (3): 6.1 Catalog Mode, 6.2 AI Commerce Mode, 6. Core Product Modes

### Community 133 - "4. Remediation plan (phases; each independently shippable)"
Cohesion: 0.12
Nodes (15): 1. Why login goes to dashboard with no Facebook login, 2. Architecture as found (verified), 3. Findings (priority order), 4. Remediation plan (phases; each independently shippable), 5. Explicitly deferred (YAGNI), Critical, High, Medium (+7 more)

### Community 137 - "app/layout.tsx"
Cohesion: 0.21
Nodes (5): cairo, tajawal, Analytics(), WhatsAppWidget(), SITE_URL

### Community 147 - "Merchant Dashboard Remediation"
Cohesion: 0.25
Nodes (7): Assumptions, Authentication And Channels, Dashboard Screens, Merchant APIs And Data, Merchant Dashboard Remediation, Proof And Rollout, Summary

### Community 155 - "83. Phase 1 Delivery Plan"
Cohesion: 0.22
Nodes (9): 83. Phase 1 Delivery Plan, Milestone 1 --- Foundation, Milestone 2 --- Catalog, Milestone 3 --- Commerce Core, Milestone 4 --- Facebook Integration, Milestone 5 --- Messenger Catalog UX, Milestone 6 --- AI Layer, Milestone 7 --- Merchant Inbox (+1 more)

### Community 160 - "57. API Design"
Cohesion: 0.33
Nodes (6): 57. API Design, Authentication, Channels, Conversations, Orders, Products

### Community 162 - "100. Production Readiness Checklist"
Cohesion: 0.40
Nodes (5): 100. Production Readiness Checklist, AI, Commerce, Facebook, UX

### Community 164 - "18. Phase 1 Scope --- Facebook Messenger"
Cohesion: 0.40
Nodes (5): 18. Phase 1 Scope --- Facebook Messenger, AI, Channel, Commerce, Merchant

### Community 166 - "1. Executive Summary"
Cohesion: 0.50
Nodes (4): 1. Executive Summary, Phase 1 --- Facebook Messenger, Phase 2 --- WhatsApp, TijaratkBot --- Facebook Messenger Commerce Bot Implementation Plan

### Community 171 - "5. Recommended Customer UX"
Cohesion: 0.50
Nodes (4): 5. Recommended Customer UX, Mode A --- Structured browsing, Mode B --- Natural-language search, Mode C --- Conversational ordering

### Community 172 - "73. Metrics"
Cohesion: 0.50
Nodes (4): 73. Metrics, AI metrics, Business metrics, UX metrics

### Community 173 - "7. Why This Is Especially Important for 300 Products"
Cohesion: 0.50
Nodes (4): 7. Why This Is Especially Important for 300 Products, Problem 1 --- Discovery, Problem 2 --- Decision overload, Problem 3 --- Conversation context

### Community 174 - "80. Testing Strategy"
Cohesion: 0.50
Nodes (4): 80. Testing Strategy, Backend unit tests, Channel tests, Integration tests

### Community 176 - "6. The Hybrid UX Principle"
Cohesion: 0.67
Nodes (3): 6. The Hybrid UX Principle, AI for:, Structured UI for:

### Community 177 - "82. UX Test Dataset"
Cohesion: 0.67
Nodes (3): 82. UX Test Dataset, Task, Task

### Community 178 - "8. Recommended Customer Conversation Flow"
Cohesion: 0.67
Nodes (3): 8.1 Entry, 8.2 Browse, 8. Recommended Customer Conversation Flow

## Knowledge Gaps
- **690 isolated node(s):** `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises`, `node`, `$schema` (+685 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `index.ts` to `units.spec.ts`, `channels.controller.ts`, `.updateStatus`, `.takeover`, `MerchantsController`, `CurrentMerchant`, `Merchant`, `harness.ts`, `.ingest`, `delivery.controller.ts`, `labeled-examples.controller.ts`, `AuthController`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Merchant` connect `Merchant` to `.updateStatus`, `index.ts`, `ZernioConnectController`, `.takeover`, `MerchantsController`, `CurrentMerchant`, `.ingest`, `delivery.controller.ts`, `labeled-examples.controller.ts`, `AuthController`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `CurrentMerchant` connect `CurrentMerchant` to `.updateStatus`, `index.ts`, `ZernioConnectController`, `.takeover`, `MerchantsController`, `Merchant`, `.ingest`, `delivery.controller.ts`, `labeled-examples.controller.ts`, `AuthController`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript/no-explicit-any`, `typescript/no-floating-promises` to the rest of the system?**
  _690 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `units.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05286006128702758 - nodes in this community are weakly interconnected._
- **Should `registry.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06610259122157588 - nodes in this community are weakly interconnected._
- **Should `TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md` be split into smaller, more focused modules?**
  _Cohesion score 0.02127659574468085 - nodes in this community are weakly interconnected._