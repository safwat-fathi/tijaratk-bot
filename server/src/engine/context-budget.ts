import { pyJsonDumps } from '../core/pystr.js';

export interface HistoryMessage {
  direction: 'INBOUND' | 'OUTBOUND';
  normalizedText?: string | null;
  rawText?: string | null;
}
export interface PromptExample {
  normalizedText: string;
  intent?: string | null;
  extraction?: unknown;
  action?: unknown;
}
export type PromptMode = 'intent' | 'extraction' | 'action';

const truthy = (v: unknown) => v != null && !(typeof v === 'object' && Object.keys(v as object).length === 0);

export function buildContextPrompt(p: {
  history: HistoryMessage[];
  slots: Record<string, unknown>;
  currentText: string;
  maxTurns: number;
  examples?: PromptExample[] | null;
  mode?: PromptMode;
}): string {
  const mode = p.mode ?? 'intent';
  const recent = p.history.slice(-p.maxTurns); // slice(-0) returns everything, same as Python history[-0:]
  const lines: string[] = [];

  if (p.examples?.length) {
    lines.push('examples:');
    for (const ex of p.examples) {
      if (mode === 'extraction') {
        lines.push(`- customer: ${ex.normalizedText} -> extraction: ${truthy(ex.extraction) ? pyJsonDumps(ex.extraction) : '{}'}`);
      } else if (mode === 'action') {
        lines.push(`- customer: ${ex.normalizedText} -> action: ${truthy(ex.action) ? pyJsonDumps(ex.action) : '{}'}`);
      } else {
        lines.push(`- customer: ${ex.normalizedText} -> intent: ${ex.intent}`);
      }
    }
    lines.push('');
  }

  lines.push(`slots: ${pyJsonDumps(p.slots)}`);
  for (const msg of recent) {
    const speaker = msg.direction === 'INBOUND' ? 'customer' : 'merchant';
    lines.push(`${speaker}: ${msg.normalizedText || msg.rawText || ''}`);
  }
  lines.push(`customer: ${p.currentText} -> ${mode === 'intent' ? 'intent' : mode}:`);
  return lines.join('\n');
}
