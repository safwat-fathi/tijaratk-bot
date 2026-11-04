// Deliberately empty: a wrong estimated_cost is worse than an absent one (SRD §32). model -> [input $/1k, output $/1k]
const COST_PER_1K_TOKENS: Record<string, [number, number]> = {};

export function estimateCost(model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates || inputTokens == null || outputTokens == null) return null;
  return (inputTokens / 1000) * rates[0] + (outputTokens / 1000) * rates[1];
}
