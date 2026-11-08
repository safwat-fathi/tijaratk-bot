import { z } from 'zod';
import type { ConvState } from '../db/types.js';
import { type CallUsage, complete, llmProvider } from './gateway.js';
import { buildSystemPrompt, classificationTaskBlock } from './prompts.js';
import { evaluatePostflight, evaluatePreflight } from './routing-policy.js';
import { IntentClassification } from './schemas.js';

/**
 * A plain string field only constrains JSON shape; an enum of the exact known intents makes
 * grammar-constrained decoding unable to emit anything else. Parsing still goes through the
 * static IntentClassification (keeps its confidence normalizer).
 */
const intentResponseSchema = (known: string[]) =>
  z.object({ intent: z.enum(known as [string, ...string[]]), confidence: z.number().min(0).max(1) });

export async function classifyMessage(p: {
  prompt: string;
  knownIntents: string[];
  threshold: number;
  correctionCount: number;
  text: string;
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
}): Promise<[IntentClassification, string | null, CallUsage | null]> {
  const pre = evaluatePreflight({ text: p.text, correctionCount: p.correctionCount });
  if (pre) return [{ intent: 'other', confidence: 0 }, pre, null];

  const systemPrompt = buildSystemPrompt({
    taskBlock: classificationTaskBlock(p.knownIntents),
    merchantName: p.merchantName,
    convState: p.convState,
    slots: p.slots,
  });
  let [result, usage] = await complete(llmProvider(), {
    systemPrompt,
    userPrompt: p.prompt,
    jsonSchemaFor: intentResponseSchema(p.knownIntents),
    parseWith: IntentClassification,
    schemaName: 'intent_classification',
  });

  let vocabularyReason: string | null = null;
  if (!p.knownIntents.includes(result.intent)) {
    vocabularyReason = 'intent_outside_known_vocabulary';
    result = { intent: 'other', confidence: result.confidence };
  }
  const reason = vocabularyReason ?? evaluatePostflight({ confidence: result.confidence, threshold: p.threshold });
  return [result, reason, usage];
}
