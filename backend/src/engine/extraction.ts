import { z } from 'zod';
import type { ConvState } from '../db/types.js';
import { type CallUsage, complete, llmProvider } from './gateway.js';
import { EXTRACTION_TASK_BLOCK, buildSystemPrompt } from './prompts.js';
import { evaluatePostflight, evaluatePreflight } from './routing-policy.js';
import { ExtractionBase, ExtractionResult } from './schemas.js';

export async function extractOrder(p: {
  prompt: string;
  threshold: number;
  correctionCount: number;
  text: string;
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
}): Promise<[ExtractionResult, string | null, CallUsage | null]> {
  const pre = evaluatePreflight({ text: p.text, correctionCount: p.correctionCount });
  if (pre) return [ExtractionResult.parse({ confidence: 0 }), pre, null];

  const [result, usage] = await complete(llmProvider(), {
    systemPrompt: buildSystemPrompt({
      taskBlock: EXTRACTION_TASK_BLOCK,
      merchantName: p.merchantName,
      convState: p.convState,
      slots: p.slots,
    }),
    userPrompt: p.prompt,
    jsonSchemaFor: ExtractionBase as z.ZodType,
    parseWith: ExtractionResult,
    schemaName: 'order_extraction',
  });
  const reason = evaluatePostflight({
    confidence: result.confidence,
    threshold: p.threshold,
    ambiguousFields: result.ambiguous_fields,
  });
  return [result, reason, usage];
}
