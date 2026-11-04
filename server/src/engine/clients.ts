import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { getSettings } from '../config.js';

const log = new Logger('app.engine.ai_calls');

export class AICallError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AICallError';
  }
}

/** The slice of the OpenAI client the engine uses; tests substitute a fake. */
export interface AiClient {
  chat: { completions: { create: (body: any) => Promise<any> } };
  embeddings: { create: (body: any) => Promise<any> };
}

let deepseek: AiClient | undefined;
let embedding: AiClient | undefined;

/**
 * OpenRouter may answer with an SSE stream even when `stream: false` was requested (the `~deepseek/...` model
 * routes do - and that is the configured model). Accept both: JSON completion, or SSE chunks aggregated into
 * a ChatCompletion-shaped object with `.choices[0].message.content` and `.usage`.
 */
export async function readCompletion(res: Response): Promise<any> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) return res.json();

  let content = '';
  let usage: unknown = null;
  for (const line of (await res.text()).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let chunk: any;
    try {
      chunk = JSON.parse(data);
    } catch {
      continue; // keep-alive comments / partial garbage
    }
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') content += delta;
    if (chunk.usage != null) usage = chunk.usage;
  }
  return { choices: [{ message: { content, role: 'assistant' }, finish_reason: 'stop' }], usage };
}

function build(baseURL: string, apiKey: string): AiClient {
  const s = getSettings();
  const sdk = new OpenAI({
    baseURL,
    apiKey: apiKey || 'missing',
    timeout: s.AI_REQUEST_TIMEOUT_SECONDS * 1000,
    maxRetries: s.AI_MAX_RETRIES,
  });
  return {
    chat: {
      completions: {
        // asResponse(): the SDK still does auth/retries/status->APIError, we just control body parsing.
        create: async (body) => readCompletion(await sdk.chat.completions.create(body).asResponse()),
      },
    },
    embeddings: { create: (body) => sdk.embeddings.create(body) },
  };
}

export const getDeepseekClient = (): AiClient =>
  (deepseek ??= build(getSettings().OPENROUTER_BASE_URL, getSettings().OPENROUTER_API_KEY));
export const getEmbeddingClient = (): AiClient =>
  (embedding ??= build(getSettings().EMBEDDING_BASE_URL, getSettings().EMBEDDING_API_KEY));

export const setAiClientsForTests = (c?: { deepseek?: AiClient; embedding?: AiClient }) => {
  deepseek = c?.deepseek;
  embedding = c?.embedding;
};

export const isApiError = (e: unknown): e is InstanceType<typeof OpenAI.APIError> => e instanceof OpenAI.APIError;

export function parseJsonContent(response: any): unknown {
  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new AICallError('empty content');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new AICallError(`non-json content: ${JSON.stringify(String(content).slice(0, 200))}`, { cause: e });
  }
}

/** §7 observability: token counts + latency for every AI call. */
export function recordAiCall(tier: string, model: string, startMs: number, usage: any): void {
  const duration = Date.now() - startMs;
  log.log(
    `ai_call tier=${tier} model=${model} duration_ms=${duration.toFixed(1)} prompt_tokens=${usage?.prompt_tokens ?? null} completion_tokens=${usage?.completion_tokens ?? null}`,
  );
}
