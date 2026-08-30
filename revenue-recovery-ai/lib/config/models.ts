/**
 * Model selection and cost accounting.
 *
 * Nothing in the app hard-codes a model name (section 23): call sites ask for a
 * TIER, and the tier resolves through an environment variable. That way the
 * cost/quality tradeoff is an operator decision, changeable without a deploy.
 *
 * Default is claude-opus-5 everywhere. To cut cost on the high-volume paths,
 * set AI_MODEL_FAST to a cheaper model -- see docs/COST_CONTROL.md for the
 * price table and what each tier is used for.
 */
export type ModelTier = "primary" | "fast";

const DEFAULT_MODEL = "claude-opus-5";

export function modelFor(tier: ModelTier): string {
  if (tier === "fast") {
    return process.env.AI_MODEL_FAST || process.env.AI_MODEL || DEFAULT_MODEL;
  }
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

/** USD per million tokens. Used for usage accounting and admin cost reporting. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

/** Falls back to Opus pricing so an unknown model over-reports rather than
 *  silently reporting zero cost. */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
}

/** Effort per tier. Classification and extraction do not need deep reasoning. */
export function effortFor(tier: ModelTier): "low" | "medium" | "high" {
  return tier === "fast" ? "low" : "medium";
}
