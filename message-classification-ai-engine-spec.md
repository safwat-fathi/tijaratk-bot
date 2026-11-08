# TijaratkBot: Message Classification & AI Engine — Technical Spec (Core)

Scope: storage → normalization → classification → structured extraction, using DeepSeek v4 Flash (via OpenRouter API) as the sole LLM tier for both stages — see §1.1 for why an earlier design used a dedicated dialect-tuned model (NileChat-4B) here instead, and §1.2/`app/engine/prompts.py` for how that dialect strength is mitigated now. Embeddings use a multilingual model (`BAAI/bge-m3`) via OpenRouter. No channel/webhook integration in this doc — starts from "a message has arrived and is ready to be processed."

---

## 1. Model References

### 1.1 Retired Model (formerly Tier 1): MBZUAI-Paris/Nile-Chat-4B

**Historical.** NileChat-4B was the original primary classifier/extractor; it has been fully removed from the codebase and replaced by DeepSeek v4 Flash as the sole LLM tier (§1.2). Kept here for context on why a dialect-aware system prompt (`app/engine/prompts.py`) was needed after retiring it — not because current routing depends on any of these limits:

| Property                         | Value                                                                                                                  | Design implication                                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base architecture                | Gemma 3 4B (`gemma3_text`)                                                                                             | Standard transformer, served like any Gemma 3 model                                                                                                                                                                                                  |
| Parameters                       | 4B, BF16                                                                                                               | Fits on a single modest GPU (~8–10GB VRAM in bf16; less with quantized GGUF builds)                                                                                                                                                                  |
| Scripts supported                | Arabic script + Arabizi (Latin script), natively — not via translation                                                 | No separate Arabizi→Arabic pre-translation step needed before this model; feed it either script directly                                                                                                                                             |
| **Training max sequence length** | **2048 tokens** (continual pretrain + SFT + DPO)                                                                       | **Hard practical context budget.** The Gemma 3 architecture may accept longer inputs, but Egyptian-dialect tuning was never validated past this — treat 2048 tokens as your working ceiling until you've empirically tested longer inputs yourself   |
| Serving                          | Transformers, vLLM, SGLang, Docker Model Runner; GGUF quantizations available for llama.cpp/Ollama/LM Studio           | **Historical Note:** NileChat was originally chosen for its native Egyptian dialect strength, but has been replaced by DeepSeek v4 Flash as the sole LLM tier. The dialect strength is now mitigated via a dialect-aware system prompt (`app/engine/prompts.py`). |
| License                          | Gemma license                                                                                                          | Check commercial-use terms before shipping                                                                                                                                                                                                           |
| Strength profile                 | Beats general 7B–14B models on Egyptian benchmarks; dominant specifically on transliteration (Arabic script ↔ Arabizi) | Best-fit for normalization-adjacent tasks and dialect-fluent generation; **not evaluated for general multi-step reasoning at frontier-model levels** — a 4B model's reasoning ceiling is lower than a frontier model's regardless of dialect fluency |
| Structured output                | No native function-calling/tool-use interface documented                                                               | Must enforce JSON schema via constrained/guided decoding (e.g., vLLM guided decoding, `outlines`, or grammar-constrained sampling) rather than assuming native structured output support                                                             |
| Embedding capability             | **None** — this is a generative chat model, not an embedding model                                                     | Embeddings need a dedicated model — see §1.3 and §5                                                                                                                                                                                                  |

### 1.2 Sole LLM Tier: DeepSeek v4 Flash (via OpenRouter API)

| Property             | Value                                                              | Design implication                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                 | Sole LLM tier — classification + extraction                       | Handles every message that reaches a model call, from routine to high-reasoning, ambiguous, or low-confidence cases alike                                                    |
| Context capacity     | Large context window (128k+ tokens)                                | Ingests full thread histories + slot states without truncation — no fixed context-budget ceiling (§7)                                                                        |
| Reasoning & Tool use | Frontier-grade multi-step reasoning & structured output capability | Handles complex cross-referencing, multi-intent resolution, and edge-case field extractions                                                                                  |
| Serving & Provider   | **OpenRouter API** (`https://openrouter.ai/api/v1`)                | Accessible via standard OpenAI SDK/HTTP client (`deepseek/deepseek-chat` or provider alias on OpenRouter). Requires `OPENROUTER_API_KEY`, eliminating direct GPU self-hosting |

### 1.3 Embedding Model: BAAI/bge-m3 (Self-Hosted Multilingual)

> [!NOTE]
> **Model Selection Note:** `BAAI/bge-base-en-v1.5` is strictly English-only (`-en-`) and will fail on Arabic script and Arabizi. The proper multilingual model from BAAI is **`BAAI/bge-m3`** (or alternatively **`intfloat/multilingual-e5-base`** if 768-dim vectors are preferred).

| Property       | Value                                                         | Design implication                                                                                                  |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Model ID       | `BAAI/bge-m3`                                                 | True multilingual support for 100+ languages including Arabic (MSA + dialect vocabulary) and Latin-script Arabizi   |
| Dimensions     | **1024 dimensions**                                           | Vector dimension for PostgreSQL `pgvector` columns (`vector(1024)`)                                                 |
| Serving Method | Self-hosted (e.g., Hugging Face TEI container, FastEmbed, ONNX)| Low-latency local embedding generation with zero per-token third-party API costs                                    |
| Max Sequence   | 8192 tokens                                                   | Ample capacity for whole messages, turn histories, and labeled examples                                             |

### 1.4 Customer Reply Phrasing Model: GPT-4o-mini (via OpenRouter API)

| Property             | Value                                                              | Design implication                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                 | Customer-facing generation tier (`REPLY_LLM_MODEL`)               | Crafts final customer-facing responses grounded in catalog facts and policies. Falls back to `LLM_MODEL` (DeepSeek) when unset.                                              |
| Context capacity     | 128k context window                                                | Ingests turn history, store facts (catalog, policies), and action results.                                                                                                   |
| Phrasing & Dialect   | High natural dialect fluency and consistency                       | Excels at warm, concise Egyptian Arabic phrasing, adherence to gender agreement rules, and strict grounding without hallucinations.                                        |
| Serving & Provider   | **OpenRouter API** (`openai/gpt-4o-mini`)                          | Managed via standard OpenAI client SDK (`getLlmClient()`), tracked under `aiUsageEvents` with model-specific token counts and latency.                                        |

---

## 2. Data Model

```prisma
model Merchant {
  id            String   @id @default(cuid())
  name          String
  products      Product[]
  conversations Conversation[]
}

model Conversation {
  id            String   @id @default(cuid())
  merchantId    String
  merchant      Merchant @relation(fields: [merchantId], references: [id])
  customerRef   String
  state         ConvState      // NEW | GATHERING | CONFIRMING | COMPLETED | ABANDONED
  slots         Json           // { line_items: [], address?, phone?, payment_method? }
  lastMessageAt DateTime
  messages      Message[]
  orders        Order[]
}

model Message {
  id                 String   @id @default(cuid())
  conversationId     String
  conversation       Conversation @relation(fields: [conversationId], references: [id])
  direction          Direction        // INBOUND | OUTBOUND
  rawText            String?
  normalizedText     String?
  intent             String?
  intentConfidence   Float?
  modelTier          ModelTier?       // RULE | DEEPSEEK
  escalationReason   String?          // populated when a preflight/postflight trigger flags the result for review (see §4)
  embedding          Unsupported("vector(1024)")?  // 1024-dim dense vector from BAAI/bge-m3
  createdAt          DateTime @default(now())
}

model Product {
  id            String   @id @default(cuid())
  merchantId    String
  merchant      Merchant @relation(fields: [merchantId], references: [id])
  name          String
  aliases       String[]
  variants      Json
  embedding     Unsupported("vector(1024)")?  // 1024-dim dense vector from BAAI/bge-m3
}

model Order {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id])
  extractedPayload  Json
  confirmedPayload  Json?
  status            OrderStatus     // AUTO_CONFIRMED | PENDING_REVIEW | CONFIRMED | REJECTED
  confidenceScore   Float
  extractedByTier   ModelTier
}

model LabeledExample {
  id             String   @id @default(cuid())
  merchantId     String?
  normalizedText String
  intent         String
  extraction     Json?
  embedding      Unsupported("vector(1024)")?  // 1024-dim dense vector from BAAI/bge-m3
  source         String          // "merchant_correction" | "cluster_labeling"
}

enum ModelTier {
  RULE
  DEEPSEEK
}
```

`modelTier` and `escalationReason` are not optional extras — they're what let you later answer "how often am I flagging for review, and why," which is your main cost and quality signal.

---

## 3. Pipeline

```
Message (already stored, normalizedText populated)
        │
        ▼
[Tier 0: Rule-based short-circuit]
   keyword/regex check for greeting, obvious spam, single-emoji reactions
        │ (no match)
        ▼
[Context Assembler]
   builds prompt: last N turns + slot state (no fixed token ceiling — §7)
        │
        ▼
[DeepSeek v4 Flash — Intent Classification]
   constrained decoding → one of the fixed intent labels + confidence
        │
        ▼ (if intent == purchase_intent AND state ∈ {GATHERING, CONFIRMING})
[DeepSeek v4 Flash — Structured Extraction]
   schema-constrained JSON output (line_items, address, phone, payment_method,
   ambiguous_fields)
        │
        ▼
[Review-flagging — single pass, no retry/second call]
   confidence < threshold, OR ambiguous_fields non-empty, OR repeated
   correction, OR reasoning-heavy content
        │
        ├─ none hold ──► Message.escalationReason = null, Order.status = AUTO_CONFIRMED
        │
        └─ any hold ───► Message.escalationReason = <trigger>, Order.status = PENDING_REVIEW
```

---

## 4. Review-Flagging Policy

This is the part that needs to be exact, since "flag for review when needed" is meaningless without hard triggers. There is no second model and no escalation target — DeepSeek v4 Flash is the sole LLM tier (§1.2), so every message gets exactly one classification call and, if applicable, one extraction call. These triggers (checked via `evaluate_preflight`/`evaluate_postflight` in `app/engine/routing_policy.py`) only decide whether that single result gets flagged for human review — flag it when **any** of the following hold:

1. **Confidence threshold breach** — classification or extraction confidence below a tuned cutoff (start at 0.7, adjust empirically per merchant/label once you have data).
2. **Non-empty `ambiguous_fields`** in the extraction output — the model is explicitly telling you it wasn't sure.
3. **Repeated correction** — the merchant has rejected/edited the extraction twice already in the same conversation.
4. **Reasoning-heavy content, not just dialect-heavy content** — messages that require multi-step reasoning, cross-referencing past orders, or resolving a genuine ambiguity in intent (not just vocabulary) rather than fluent-but-simple dialect. Flagged heuristically (message length + question-mark density + presence of conditional language "لو... يبقى...").

Everything that doesn't hit a trigger is used as-is (`Order.status = AUTO_CONFIRMED`). The goal is that flagging stays a small minority of traffic — if you find yourself flagging most messages, that's a signal your thresholds are miscalibrated, not a reason to reintroduce a second model.

**Track every flag** with its reason in `Message.escalationReason`. This remains the prioritized signal for what to improve next — if 40% of flags are the same failure pattern, that's a targeted prompt/threshold tune (`app/engine/prompts.py`, `app/engine/routing_policy.py`), not a case for bringing back a two-tier setup.

---

## 5. Embeddings

**NileChat-4B does not produce embeddings as a supported feature** — it's a generative chat model. Two real options, not interchangeable in reliability:

**Option A (recommended default): self-hosted multilingual embedding model (`BAAI/bge-m3`) + normalization bridge.**
Use a dedicated multilingual embedding model (`BAAI/bge-m3` or `intfloat/multilingual-e5-base`) served locally (e.g., via Text Embeddings Inference / TEI or FastEmbed) on the **normalized** text — Arabizi already converted, spelling already canonicalized.
- *Why `BAAI/bge-m3` instead of `bge-base-en-v1.5`?* `bge-base-en-v1.5` has an English-only tokenizer and vocabulary, making it ineffective for Arabic or transliterated Egyptian dialects. `bge-m3` natively handles 100+ languages including Arabic.
- The normalization step you have in place canonicalizes Egyptian dialect and Arabizi before embedding, ensuring high-quality semantic similarity search.

**Option B (experimental, don't build this first): hidden-state extraction from NileChat itself.**
Since NileChat is open-weights, you can technically mean-pool a hidden layer's activations as a pseudo-embedding. This is unvalidated for this model — it was never trained as an embedding model (no contrastive/similarity objective), so retrieval quality is unknown until you benchmark it yourself against Option A on your own labeled pairs. Worth a side experiment once you have real data, not something to depend on for MVP.

**Storage/retrieval:** pgvector column (`vector(1024)`) on `Message` and `LabeledExample`, cosine similarity (`<=>`), merchant-scoped query first with fallback to the global `LabeledExample` pool when a merchant has too little history of their own.

---

## 6. Clustering (offline, not in the request path)

Real, embedding-based clustering of accumulated messages to discover new user intents and build few-shot examples. 

- **Pure Local Computation:** The actual grouping uses `AgglomerativeClustering` over the dense embeddings (`BAAI/bge-m3`) already attached to the messages. This groups messages by true semantic similarity without requiring an LLM call.
- **Representative Extraction:** For each discovered cluster, we find the messages closest to its own centroid (via cosine similarity) to serve as the highly representative examples.
- **Batched LLM Labeling:** Only the human-readable intent label and one-sentence summary per cluster come from a single, batched LLM call to DeepSeek v4 Flash (via OpenRouter API). The LLM is provided the size of the cluster and its top representative messages.
- **Graceful Degradation:** The pipeline never loses the underlying local grouping. If the OpenRouter API fails or is unavailable, it degrades gracefully to generic fallback labels (e.g., "unknown_intent_0") rather than failing outright.
- **Persistence:** The top representative messages from these labeled clusters are written to `LabeledExample` (`source = "cluster_labeling"`), making them immediately available as few-shot context for DeepSeek's real-time classification/extraction.

---

## 7. Serving Notes

- **DeepSeek v4 Flash:** Point your AI-client module at the OpenRouter API (`https://openrouter.ai/api/v1`) using `OPENROUTER_API_KEY` with OpenAI-compatible payload structure. It serves as the sole LLM tier for all classification and extraction, relying on the dialect-aware system prompt (`app/engine/prompts.py`) to mitigate the loss of NileChat's native dialect training.
- **Embeddings (`BAAI/bge-m3`):** Run self-hosted embedding inference via Hugging Face TEI (Text Embeddings Inference) Docker container or local ONNX/FastEmbed runtime for low latency and zero per-token cost.
- **Observability:** Log token counts and latencies per call — useful for cost/latency monitoring; there's no fixed context-budget ceiling to enforce against (§1.2).
