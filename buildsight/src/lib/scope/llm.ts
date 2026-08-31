/**
 * Optional LLM adapter for the natural-language builder.
 *
 * Scope of the model's job, enforced by the caller: turn free text into the
 * same `StructuredQuery` the deterministic parser produces. It never decides
 * compatibility, never invents a specification, and its output is validated
 * against a schema before use. Without ANTHROPIC_API_KEY the app runs entirely
 * on the deterministic parser.
 */

import { z } from "zod";
import { CATEGORIES, PLATFORMS, CALIBERS } from "@/lib/catalog/vocabulary";
import type { StructuredQuery } from "@/lib/scope/intent";

const responseSchema = z.object({
  categorySlug: z.string().optional(),
  platform: z.string().optional(),
  caliber: z.string().optional(),
  maxPriceCents: z.number().int().min(0).optional(),
  maxWeightGrams: z.number().int().min(0).optional(),
  minLengthMm: z.number().min(0).optional(),
  maxLengthMm: z.number().min(0).optional(),
  keywords: z.string().max(200).optional(),
});

const SYSTEM_PROMPT = `You convert a shopper's request about firearm components into structured search filters for a product database.

Rules:
- Reply with JSON only, matching this shape: {"categorySlug","platform","caliber","maxPriceCents","maxWeightGrams","minLengthMm","maxLengthMm","keywords"}.
- Omit any field you cannot determine from the message. Never guess a value.
- Never state whether parts are compatible; a separate rules engine decides that.
- Never invent product specifications, prices or measurements.
- categorySlug must be one of: ${CATEGORIES.map((c) => c.slug).join(", ")}.
- platform must be one of: ${PLATFORMS.map((p) => p.slug).join(", ")}.
- caliber must be one of: ${CALIBERS.join(" | ")}.
- Lengths are millimetres; prices are US cents.`;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Refine a parsed query with the model. Any failure — no key, network error,
 * bad JSON, unknown enum value — returns the deterministic query unchanged.
 */
export async function refineQueryWithLlm(
  message: string,
  fallback: StructuredQuery,
): Promise<{ query: StructuredQuery; usedLlm: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { query: fallback, usedLlm: false };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.SCOPE_MODEL || "claude-sonnet-5",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { query: fallback, usedLlm: false };

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
    const json = extractJson(text);
    if (!json) return { query: fallback, usedLlm: false };

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) return { query: fallback, usedLlm: false };

    const data = parsed.data;
    const categorySlug = CATEGORIES.some((c) => c.slug === data.categorySlug)
      ? data.categorySlug
      : fallback.categorySlug;
    const platform = PLATFORMS.some((p) => p.slug === data.platform)
      ? data.platform
      : fallback.platform;
    const caliber = CALIBERS.includes(data.caliber as (typeof CALIBERS)[number])
      ? data.caliber
      : fallback.caliber;

    return {
      query: {
        ...fallback,
        categorySlug,
        platform,
        caliber,
        maxPriceCents: data.maxPriceCents ?? fallback.maxPriceCents,
        maxWeightGrams: data.maxWeightGrams ?? fallback.maxWeightGrams,
        minLengthMm: data.minLengthMm ?? fallback.minLengthMm,
        maxLengthMm: data.maxLengthMm ?? fallback.maxLengthMm,
        q: data.keywords ?? fallback.q,
      },
      usedLlm: true,
    };
  } catch {
    return { query: fallback, usedLlm: false };
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
