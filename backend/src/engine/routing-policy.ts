import { cpLen } from '../core/pystr.js';

const REASONING_LENGTH_THRESHOLD = 300;
const QUESTION_MARK_DENSITY_THRESHOLD = 0.02;
// Density alone is meaningless on short text ("بكام ده؟" is 1/8), so only apply it past this length.
const DENSITY_CHECK_MIN_LENGTH = 60;
const CONDITIONAL_MARKERS = ['لو', 'إذا', 'اذا'];
const CONDITIONAL_RESULT_MARKERS = ['يبقى', 'هيبقى', 'بقى'];

const count = (text: string, ch: string) => text.split(ch).length - 1;

export const checkConfidenceThreshold = (confidence: number, threshold: number) =>
  confidence < threshold ? 'confidence_below_threshold' : null;

export const checkAmbiguousFields = (fields: string[]) => (fields.length ? 'ambiguous_fields_present' : null);

export const checkRepeatedCorrection = (correctionCount: number) => (correctionCount >= 2 ? 'repeated_correction' : null);

export function checkReasoningHeavy(text: string): string | null {
  const len = cpLen(text);
  const density = (count(text, '?') + count(text, '؟')) / Math.max(1, len);
  const densityHeavy = len >= DENSITY_CHECK_MIN_LENGTH && density > QUESTION_MARK_DENSITY_THRESHOLD;
  const hasConditional =
    CONDITIONAL_MARKERS.some((m) => text.includes(m)) && CONDITIONAL_RESULT_MARKERS.some((m) => text.includes(m));
  return len > REASONING_LENGTH_THRESHOLD || densityHeavy || hasConditional ? 'reasoning_heavy_content' : null;
}

/** Triggers knowable before any model call. */
export function evaluatePreflight(p: { text: string; correctionCount: number }): string | null {
  return checkRepeatedCorrection(p.correctionCount) ?? checkReasoningHeavy(p.text);
}

/** Triggers only knowable from the model's output. */
export function evaluatePostflight(p: { confidence: number; threshold: number; ambiguousFields?: string[] | null }): string | null {
  return checkConfidenceThreshold(p.confidence, p.threshold) ?? checkAmbiguousFields(p.ambiguousFields ?? []);
}
