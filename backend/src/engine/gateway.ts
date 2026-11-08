import type { ZodType } from 'zod';
import { getSettings } from '../config.js';
import {
  AICallError,
  type AiClient,
  getLlmClient,
  getEmbeddingClient,
  isApiError,
  parseJsonContent,
  recordAiCall,
} from './clients.js';
import { jsonSchemaResponseFormat } from './schemas.js';

export interface Provider {
  name: string; // "llm" - kept for CallUsage/logging, not branching
  client: AiClient;
  model: string;
  temperature: number;
}

export interface CallUsage {
  tier: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export function llmProvider(): Provider {
  const s = getSettings();
  return { name: 'llm', client: getLlmClient(), model: s.LLM_MODEL, temperature: s.LLM_TEMPERATURE };
}

function requestBody(provider: Provider, systemPrompt: string, userPrompt: string, responseFormat: unknown) {
  const s = getSettings();
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: responseFormat,
    temperature: provider.temperature,
    max_tokens: s.AI_MAX_OUTPUT_TOKENS,
    stream: false,
  };
  // OpenRouter routing preference (python: extra_body={"provider": {...}})
  if (s.OPENROUTER_PROVIDERS.length) body.provider = { order: s.OPENROUTER_PROVIDERS };
  return body;
}

async function call(client: AiClient, body: Record<string, unknown>) {
  try {
    return await client.chat.completions.create(body);
  } catch (e) {
    if (isApiError(e)) throw new AICallError(e.message, { cause: e });
    throw e;
  }
}

/**
 * One structured-output chat completion. `jsonSchemaFor` shapes what is sent upstream; `parseWith`
 * validates what comes back (they differ for classification: enum upstream, free string locally).
 */
export async function complete<T>(
  provider: Provider,
  p: { systemPrompt: string; userPrompt: string; jsonSchemaFor: ZodType; parseWith: ZodType<T>; schemaName: string },
): Promise<[T, CallUsage]> {
  const start = Date.now();
  const response = await call(
    provider.client,
    requestBody(provider, p.systemPrompt, p.userPrompt, jsonSchemaResponseFormat(p.jsonSchemaFor, p.schemaName)),
  );
  recordAiCall(provider.name, provider.model, start, response.usage);
  const latencyMs = Date.now() - start;

  const content = parseJsonContent(response);
  const parsed = p.parseWith.safeParse(content);
  if (!parsed.success) throw new AICallError(`schema validation failed: ${parsed.error.message}`);

  return [
    parsed.data,
    {
      tier: provider.name,
      provider: 'openrouter',
      model: provider.model,
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      latencyMs,
    },
  ];
}

export async function embed(text: string): Promise<number[]> {
  const s = getSettings();
  const start = Date.now();
  try {
    const response = await getEmbeddingClient().embeddings.create({ model: s.EMBEDDING_MODEL, input: text });
    recordAiCall('embedding', s.EMBEDDING_MODEL, start, response.usage);
    return Array.from(response.data[0].embedding as number[]);
  } catch (e) {
    if (isApiError(e)) throw new AICallError(e.message, { cause: e });
    throw e;
  }
}

export async function completeJson(provider: Provider, p: { systemPrompt: string; userPrompt: string }): Promise<any> {
  const start = Date.now();
  const response = await call(provider.client, requestBody(provider, p.systemPrompt, p.userPrompt, { type: 'json_object' }));
  recordAiCall(provider.name, provider.model, start, response.usage);
  return parseJsonContent(response);
}
