import type { ConvState } from '../db/types.js';
import type { HistoryMessage } from './context-budget.js';
import { type CallUsage, complete, replyProvider } from './gateway.js';
import { buildReplySystemPrompt } from './prompts.js';
import { GeneratedReply } from './schemas.js';

const renderHistory = (history?: HistoryMessage[]) =>
  history?.length
    ? `history:\n${history.map((m) => `${m.direction === 'INBOUND' ? 'customer' : 'merchant'}: ${m.normalizedText || m.rawText || ''}`).join('\n')}\n\n`
    : '';

export async function generateReply(p: {
  userPrompt: string;
  merchantName: string;
  convState: ConvState;
  slots: Record<string, unknown>;
  catalog?: string;
  policies?: string;
  history?: HistoryMessage[];
}): Promise<[GeneratedReply, CallUsage]> {
  const [result, usage] = await complete(replyProvider(), {
    systemPrompt: buildReplySystemPrompt({
      merchantName: p.merchantName,
      convState: p.convState,
      slots: p.slots,
      catalog: p.catalog,
      policies: p.policies,
      userPrompt: p.userPrompt,
      history: p.history,
    }),
    userPrompt: `${renderHistory(p.history)}${p.userPrompt}`,
    jsonSchemaFor: GeneratedReply,
    parseWith: GeneratedReply,
    schemaName: 'generated_reply',
  });
  return [result, usage];
}
