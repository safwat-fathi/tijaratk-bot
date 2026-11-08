import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContextPrompt, type HistoryMessage } from './context-budget.js';
import { estimateCost } from './cost.js';
import { checkReasoningHeavy, evaluatePostflight, evaluatePreflight } from './routing-policy.js';
import { ExtractionResult, IntentClassification, ProposedAction } from './schemas.js';
import { matchTier0 } from './tier0-rules.js';

// Golden vectors generated from the Python backend: docs/contract/gen_golden.py
const g = JSON.parse(readFileSync(new URL('../../../docs/contract/golden.json', import.meta.url), 'utf8'));

describe('golden: tier0', () => {
  it.each(g.tier0)('$input', ({ input, output }: any) => expect(matchTier0(input)).toBe(output));
});

describe('golden: routing policy', () => {
  it.each(g.reasoning_heavy)('reasoning_heavy %#', ({ input, output }: any) =>
    expect(checkReasoningHeavy(input)).toBe(output));
  it.each(g.preflight)('preflight %#', (c: any) =>
    expect(evaluatePreflight({ text: c.text, correctionCount: c.correction_count })).toBe(c.output));
  it.each(g.postflight)('postflight %#', (c: any) =>
    expect(
      evaluatePostflight({ confidence: c.confidence, threshold: c.threshold, ambiguousFields: c.ambiguous_fields }),
    ).toBe(c.output));
  it.each(g.cost)('cost %#', (c: any) => expect(estimateCost(c.model, c.in, c.out)).toBe(c.output));
});

describe('golden: context prompt', () => {
  const cp = g.context_prompt;
  const history: HistoryMessage[] = cp.history.map((m: any) => ({
    direction: m.direction,
    normalizedText: m.normalized_text,
    rawText: m.raw_text,
  }));
  const example = { normalizedText: cp.example.normalized_text, ...cp.example };
  it.each(cp.cases)('$mode turns=$max_turns examples=$with_examples', (c: any) => {
    expect(
      buildContextPrompt({
        history,
        slots: cp.slots,
        currentText: cp.current_text,
        maxTurns: c.max_turns,
        examples: c.with_examples ? [example] : null,
        mode: c.mode,
      }),
    ).toBe(c.output);
  });
});

describe('golden: schemas', () => {
  const run = (schema: any, cases: any[]) =>
    cases.forEach((c) => {
      const r = schema.safeParse(c.input);
      if (c.error) expect(r.success, JSON.stringify(c.input)).toBe(false);
      else {
        expect(r.success, JSON.stringify(c.input)).toBe(true);
        expect(r.data).toEqual(c.output);
      }
    });
  it('intent', () => run(IntentClassification, g.schemas.intent));
  it('extraction', () => run(ExtractionResult, g.schemas.extraction));
  it('action', () => run(ProposedAction, g.schemas.action));
});
