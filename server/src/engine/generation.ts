import type { ConvState } from '../db/types.js';
import { type CallUsage, complete, deepseekProvider } from './gateway.js';
import { GENERATION_TASK_BLOCK, buildSystemPrompt } from './prompts.js';
import { GeneratedReply } from './schemas.js';

export async function generateReply(p: {
  userPrompt: string;
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
}): Promise<[string, CallUsage]> {
  const [result, usage] = await complete(deepseekProvider(), {
    systemPrompt: buildSystemPrompt({
      taskBlock: GENERATION_TASK_BLOCK,
      merchantName: p.merchantName,
      convState: p.convState,
      slots: p.slots,
    }),
    userPrompt: p.userPrompt,
    jsonSchemaFor: GeneratedReply,
    parseWith: GeneratedReply,
    schemaName: 'generated_reply',
  });
  return [result.reply, usage];
}
