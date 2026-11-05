# Graph Report - tijaratk-bot  (2026-11-05)

## Corpus Check
- 220 files · ~370,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1617 nodes · 3132 edges · 121 communities (106 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d0e78198`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- models.ts
- index.ts
- harness.ts
- TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md
- CurrentMerchant
- devDependencies
- app/page.tsx
- parse
- classification.ts
- devDependencies
- workspace.tsx
- store-knowledge/service.ts
- compilerOptions
- schema.ts
- delivery.controller.ts
- pipeline.ts
- getBaseUrl
- demo/actions.ts
- orders-client.tsx
- compilerOptions
- checkResponse
- meta-client.ts
- config.ts
- gateway.ts
- checkout/service.ts
- registry.ts
- settings.json
- scripts
- dependencies
- TijaratkBot_SRD.md
- TijaratkBot_PRD.md
- pure.spec.ts
- products/service.ts
- login/actions.ts
- .updateStatus
- order-writer.ts
- channels.controller.ts
- types.ts
- schemas.ts
- ChannelsController
- tsconfig.build.json
- checkout.controller.ts
- DbOrTx
- DemoController
- .takeover
- MerchantsController
- server/package.json
- .ingest
- Implementation decisions (phases 1-6, built 2026-11-04)
- Fernet
- HealthController
- product-catalog.tsx
- .oxlintrc.json
- nest-cli.json
- product-matching.ts
- CoreModule
- testimonials.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- TijaratkBot server (NestJS)
- channels/service.ts
- server/AGENTS.md
- drizzle-orm
- jsonwebtoken
- @nestjs/core
- @nestjs/platform-express
- reflect-metadata
- twilio
- setup.ts
- 7. AI Is an Add-On
- TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)
- nav.tsx
- pricing/page.tsx
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
- faq/page.tsx
- [slug]/page.tsx
- Merchant Dashboard Remediation
- features-content.ts
- how-it-works-content.ts
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
1. `Merchant` - 40 edges
2. `CurrentMerchant` - 40 edges
3. `getBaseUrl()` - 33 edges
4. `Db` - 31 edges
5. `processMessage()` - 29 edges
6. `getSettings()` - 27 edges
7. `parse()` - 27 edges
8. `notFound()` - 24 edges
9. `DbOrTx` - 24 edges
10. `checkResponse()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `sendMessage()` --calls--> `getBaseUrl()`  [EXTRACTED]
  frontend/app/demo/actions.ts → frontend/lib/api.ts
- `fetchProductsAction()` --calls--> `getBaseUrl()`  [EXTRACTED]
  frontend/app/demo/actions.ts → frontend/lib/api.ts
- `Workspace()` --calls--> `fetchProductsAction()`  [EXTRACTED]
  frontend/app/demo/workspace.tsx → frontend/app/demo/actions.ts
- `MerchantDashboard()` --calls--> `fetchProductsAction()`  [EXTRACTED]
  frontend/app/merchant/page.tsx → frontend/app/demo/actions.ts
- `ProductsClient()` --indirect_call--> `fetchProductsAction()`  [INFERRED]
  frontend/app/merchant/products/products-client.tsx → frontend/app/demo/actions.ts

## Import Cycles
- None detected.

## Communities (121 total, 15 thin omitted)

### Community 0 - "models.ts"
Cohesion: 0.05
Nodes (66): agglomerativeCosine(), clusterMessages(), EmbeddedMessage, fetchEmbeddedMessages(), labelCluster(), representativeMessages(), runClustering(), databaseUrl() (+58 more)

### Community 1 - "index.ts"
Cohesion: 0.10
Nodes (32): Settings, pools, ApiError, RateLimitMiddleware, SKIP, Inject, Injectable, CHANNEL_QUEUE_NAME (+24 more)

### Community 2 - "harness.ts"
Cohesion: 0.10
Nodes (26): Catch, AppModule, Module, DetailExceptionFilter, createAccessToken(), configureHttp(), app, setup() (+18 more)

### Community 3 - "TijaratkBot_Facebook_WhatsApp_Implementation_Plan.md"
Cohesion: 0.02
Nodes (93): 101. What Not to Build in Phase 1, 102. Recommended Build Order, 103. Final Architecture, 104. The Most Important Engineering Rule, 105. Final Recommendation, 10. Product Detail UX, 11. Variant Resolution, 12. Cart UX (+85 more)

### Community 4 - "CurrentMerchant"
Cohesion: 0.08
Nodes (28): AuthController, Controller, Get, Inject, UseGuards, CurrentMerchant, Merchant, ConversationsController (+20 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (39): drizzle-kit, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint, prettier (+31 more)

### Community 6 - "app/page.tsx"
Cohesion: 0.15
Nodes (11): Page(), PricingSection(), FAQSection(), getFaqs(), Features(), Hero(), HowItWorks(), MarketProof() (+3 more)

### Community 7 - "parse"
Cohesion: 0.09
Nodes (22): notFound(), parse(), Create, DEFAULT_INTENTS, extraction, intent, LabeledExamplesController, Body (+14 more)

### Community 8 - "classification.ts"
Cohesion: 0.16
Nodes (25): ConvState, resolveAction(), classifyMessage(), intentResponseSchema(), extractOrder(), CallUsage, complete(), deepseekProvider() (+17 more)

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, dependencies, @inlang/paraglide-js, @inlang/paraglide-next, lucide-react, next, nextjs-toploader (+33 more)

### Community 10 - "workspace.tsx"
Cohesion: 0.15
Nodes (18): fetchKnowledgeAction(), IngestState, AIInsights(), findProduct(), DemoProductCatalog(), formatVariants(), getImageForProduct(), Home() (+10 more)

### Community 11 - "store-knowledge/service.ts"
Cohesion: 0.10
Nodes (21): iso(), StoreKnowledge, getConversationMessages(), listConversations(), createKnowledge(), deleteKnowledge(), listKnowledge(), StoreKnowledgeRead (+13 more)

### Community 12 - "compilerOptions"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+22 more)

### Community 13 - "schema.ts"
Cohesion: 0.07
Nodes (28): aiActions, aiUsageEvents, cartItems, carts, cartstatus, channel, channelConnections, conversations (+20 more)

### Community 14 - "delivery.controller.ts"
Cohesion: 0.11
Nodes (21): DeliveryArea, Create, DeliveryController, NOTE: unlike the Python router (which never committed - its writes were rolled…, Body, Controller, Delete, Get (+13 more)

### Community 15 - "pipeline.ts"
Cohesion: 0.13
Nodes (25): Message, Order, ConversationNotFoundError, MessageIngestRequest, OutboundMessage, COST_PER_1K_TOKENS, estimateCost(), findSimilarExamples() (+17 more)

### Community 16 - "getBaseUrl"
Cohesion: 0.19
Nodes (17): updateAutoLearningAction(), updateWelcomeMessageAction(), verifyFacebookTokens(), AutoLearningToggle(), toggle(), SettingsPage(), WelcomeMessageEditor(), handleSave() (+9 more)

### Community 17 - "demo/actions.ts"
Cohesion: 0.15
Nodes (16): ConversationRecord, fetchConversationsAction(), MessageRecord, returnToAiAction(), sendManualReplyAction(), sendMessage(), takeoverConversationAction(), initialState (+8 more)

### Community 18 - "orders-client.tsx"
Cohesion: 0.16
Nodes (15): createManualOrderAction(), fetchOrdersAction(), fetchProductsAction(), ManualOrderResult, updateOrderStatusAction(), OrdersClient(), OrdersPage(), ProductsPage() (+7 more)

### Community 19 - "compilerOptions"
Cohesion: 0.09
Nodes (22): node, vitest/globals, compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators (+14 more)

### Community 20 - "checkResponse"
Cohesion: 0.18
Nodes (18): checkResponse(), createExampleAction(), createKnowledgeAction(), deleteExampleAction(), deleteKnowledgeAction(), fetchExamplesAction(), fetchMessagesAction(), getAuthHeaders() (+10 more)

### Community 21 - "meta-client.ts"
Cohesion: 0.15
Nodes (19): Merchant, Body, HttpCode, Post, FacebookIdentity, FacebookPage, fetchUserPages(), get() (+11 more)

### Community 22 - "config.ts"
Cohesion: 0.14
Nodes (11): bool, csvOrJson, FALSE, loadSettings(), schema, setSettingsForTests(), TRUE, setAiClientsForTests() (+3 more)

### Community 23 - "gateway.ts"
Cohesion: 0.26
Nodes (16): getSettings(), AICallError, AiClient, build(), getDeepseekClient(), getEmbeddingClient(), isApiError(), log (+8 more)

### Community 24 - "checkout/service.ts"
Cohesion: 0.20
Nodes (14): addItem(), CartItemNotFoundError, getItemForConversation(), getOrCreateActiveCart(), removeItem(), updateItem(), activeCartRows(), createOrder() (+6 more)

### Community 25 - "registry.ts"
Cohesion: 0.18
Nodes (16): ActionResolution, renderResponse(), checkProductOwnership(), checkVariantOwnership(), evaluateAction(), ValidationError, ValidationResult, ProposedAction (+8 more)

### Community 26 - "settings.json"
Cohesion: 0.20
Nodes (9): languageTags, modules, plugin.inlang.messageFormat, pathPattern, $schema, sourceLanguageTag, ar, en (+1 more)

### Community 27 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:migrate, deploy, format, lint, start, start:debug (+10 more)

### Community 28 - "dependencies"
Cohesion: 0.12
Nodes (17): bullmq, express, ioredis, @nestjs/common, openai, pg, rxjs, dependencies (+9 more)

### Community 29 - "TijaratkBot_SRD.md"
Cohesion: 0.04
Nodes (53): 10. Product Search, 11. Conversation, 12. Conversation State, 13. Message, 14. AI Orchestrator, 15. AI Gateway, 16. L0 Router, 17. L1 Nile-Chat Service (+45 more)

### Community 30 - "TijaratkBot_PRD.md"
Cohesion: 0.07
Nodes (29): 10. L0 — Deterministic Layer, 11. L1 — Nile-Chat 4B, 12. L2 — DeepSeek V4 Flash, 13. L3 — Human Escalation, 14. AI Action Architecture, 16. Catalog Retrieval, 17. Egyptian Arabic and Arabizi Normalization, 18. Conversation State (+21 more)

### Community 31 - "pure.spec.ts"
Cohesion: 0.17
Nodes (14): cpLen(), pyJsonDumps(), stripChars(), search(), buildContextPrompt(), HistoryMessage, PromptExample, PromptMode (+6 more)

### Community 32 - "products/service.ts"
Cohesion: 0.23
Nodes (15): num(), Product, createProduct(), embeddingText(), getProduct(), ProductCreate, ProductRead, ProductUpdate (+7 more)

### Community 33 - "login/actions.ts"
Cohesion: 0.12
Nodes (18): loginWithFacebookAction(), logoutAction(), setAuthCookies(), LoginPage(), navigation, SidebarClient(), OnboardingPage(), ConnectFacebookPages() (+10 more)

### Community 34 - ".updateStatus"
Cohesion: 0.15
Nodes (12): CheckoutController, loadItems(), toOrderRead(), Body, Controller, Get, HttpCode, Inject (+4 more)

### Community 35 - "order-writer.ts"
Cohesion: 0.33
Nodes (12): centsToString(), lineTotalCents(), quantize2(), roundHalfEven(), roundScaledToCents(), scaledProduct(), toBigScaled(), toCents() (+4 more)

### Community 36 - "channels.controller.ts"
Cohesion: 0.29
Nodes (10): log, Channel, OBJECT_TO_CHANNEL, ParsedInboundMessage, parseMetaPayload(), safeJsonPayload(), verifyMetaSignature(), parseTwilioPayload() (+2 more)

### Community 37 - "types.ts"
Cohesion: 0.19
Nodes (11): Cart, CartItem, ChannelConnection, Conversation, HandoffReason, NewMessage, OrderStatus, ConversationNotFoundError (+3 more)

### Community 38 - "schemas.ts"
Cohesion: 0.22
Nodes (10): J, objectSig(), ours(), sig(), confidence, ExtractedLineItem, ExtractionBase, GeneratedReply (+2 more)

### Community 39 - "ChannelsController"
Cohesion: 0.26
Nodes (8): Query, Req, ChannelsController, safeEqual(), Controller, Get, Post, Res

### Community 40 - "tsconfig.build.json"
Cohesion: 0.17
Nodes (11): dist, **/*spec.ts, src, test, ./tsconfig.json, compilerOptions, rootDir, exclude (+3 more)

### Community 41 - "checkout.controller.ts"
Cohesion: 0.21
Nodes (9): OrderItem, ManualOrder, NOTIFY_STATUSES, StatusUpdate, ConversationNotFoundError, createManualOrder(), ManualOrderCreate, ProductNotFoundError (+1 more)

### Community 42 - "DbOrTx"
Cohesion: 0.31
Nodes (9): DbOrTx, LabeledExample, createExample(), embeddingFor(), LabeledExampleRead, listExamples(), log, toRead() (+1 more)

### Community 43 - "DemoController"
Cohesion: 0.29
Nodes (6): DemoController, Body, Controller, Get, Post, Res

### Community 44 - ".takeover"
Cohesion: 0.25
Nodes (8): HandoffController, Body, Controller, HttpCode, Inject, Param, Post, UseGuards

### Community 45 - "MerchantsController"
Cohesion: 0.20
Nodes (8): MerchantsController, read(), Body, Controller, Get, Inject, Patch, UseGuards

### Community 46 - "server/package.json"
Cohesion: 0.22
Nodes (8): author, description, license, name, packageManager, private, type, version

### Community 47 - ".ingest"
Cohesion: 0.22
Nodes (7): MessagesController, Body, Controller, Inject, Post, Res, UseGuards

### Community 48 - "Implementation decisions (phases 1-6, built 2026-11-04)"
Cohesion: 0.25
Nodes (7): Architecture, Decisions, Deliberate behavior differences from Python (all bug-fixes or hardening), Format, Implementation decisions (phases 1-6, built 2026-11-04), Known gaps / follow-ups, NestJS migration: decision log

### Community 49 - "Fernet"
Cohesion: 0.32
Nodes (3): Fernet, encryptedString, getFernet()

### Community 50 - "HealthController"
Cohesion: 0.29
Nodes (5): HealthController, RootController, Controller, Get, Inject

### Community 51 - "product-catalog.tsx"
Cohesion: 0.52
Nodes (6): createProductAction(), deleteProductAction(), updateProductAction(), formatVariants(), getImageForProduct(), ProductCatalog()

### Community 52 - ".oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 53 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 55 - "product-matching.ts"
Cohesion: 0.40
Nodes (5): ProductVariant, log, matchVariantHint(), resolveVariantsForLineItems(), VariantCandidate

### Community 56 - "CoreModule"
Cohesion: 0.40
Nodes (3): Global, CoreModule, Module

### Community 63 - "TijaratkBot server (NestJS)"
Cohesion: 0.50
Nodes (3): Layout, Schema changes, TijaratkBot server (NestJS)

### Community 64 - "channels/service.ts"
Cohesion: 0.67
Nodes (3): findOrCreateConversation(), ingestChannelMessage(), log

### Community 102 - "TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)"
Cohesion: 0.05
Nodes (37): Architecture, Commands (pnpm, inside `server/`), ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, Known in-progress / not-yet-implemented, Schema, Server layout (`server/src/`), Testing, Two-stage AI routing (+29 more)

### Community 103 - "nav.tsx"
Cohesion: 0.18
Nodes (8): metadata, metadata, metadata, BrandMark(), metadata, FinalCTA(), LanguageSwitcher(), Nav()

### Community 105 - "pricing/page.tsx"
Cohesion: 0.18
Nodes (11): GET(), metadata, PricingTable(), COMPARISON_CATEGORIES, ComparisonFeature, FAIR_USAGE_TERMS, getPricingMarkdown(), PAYMENT_METHODS (+3 more)

### Community 109 - "33. Onboarding"
Cohesion: 0.29
Nodes (7): 33. Onboarding, Step 1, Step 2, Step 3, Step 4, Step 5, Step 6

### Community 111 - "44. Failure Handling"
Cohesion: 0.33
Nodes (6): 44. Failure Handling, AI produces invalid JSON, Both unavailable, Commerce action fails, DeepSeek unavailable, Nile-Chat unavailable

### Community 112 - "AGENTS.md"
Cohesion: 0.29
Nodes (5): ✍️ Content & Blog Author Rule: TijaratkBot Team Only, 🚨 CRITICAL RULE: Mandatory Frontend & Server Lint Checks, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, General Guidelines, graphify

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
Nodes (4): 🚨 CRITICAL RULE: Mandatory Frontend & Server Lint Checks, ⚡ CRITICAL RULE: Server-Side Data Fetching & Page Architecture, ⛔ CRITICAL SECURITY RULE: Environment Variables & Secrets, This is NOT the Next.js you know

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

### Community 140 - "faq/page.tsx"
Cohesion: 0.27
Nodes (7): FaqClient(), GET(), metadata, FAQ_CATEGORIES, FAQ_ITEMS, FaqItem, getFaqMarkdown()

### Community 146 - "[slug]/page.tsx"
Cohesion: 0.18
Nodes (10): GET(), GET(), BlogPostPage(), parseInlineText(), renderMarkdownToReact(), renderTable(), BLOG_POSTS, BlogPost (+2 more)

### Community 147 - "Merchant Dashboard Remediation"
Cohesion: 0.25
Nodes (7): Assumptions, Authentication And Channels, Dashboard Screens, Merchant APIs And Data, Merchant Dashboard Remediation, Proof And Rollout, Summary

### Community 150 - "features-content.ts"
Cohesion: 0.47
Nodes (4): GET(), FEATURE_PILLARS, FeaturePillar, getFeaturesMarkdown()

### Community 151 - "how-it-works-content.ts"
Cohesion: 0.47
Nodes (4): GET(), getHowItWorksMarkdown(), HOW_IT_WORKS_STEPS, StepItem

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
- **644 isolated node(s):** `metadata`, `MessageRecord`, `initialState`, `KNOWLEDGE_TYPES`, `metadata` (+639 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleSave()` connect `getBaseUrl` to `DemoController`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `updateWelcomeMessageAction()` connect `getBaseUrl` to `demo/actions.ts`, `checkResponse`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `ingestInTransaction()` connect `parse` to `index.ts`, `DemoController`, `.ingest`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **What connects `metadata`, `MessageRecord`, `initialState` to the rest of the system?**
  _644 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `models.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05194805194805195 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09713487071977638 - nodes in this community are weakly interconnected._
- **Should `harness.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09830866807610994 - nodes in this community are weakly interconnected._