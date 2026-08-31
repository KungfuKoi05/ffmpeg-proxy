/**
 * Natural-language → structured filters.
 *
 * This parser is deterministic and runs first. When an LLM is configured it may
 * only *refine* the same structure (see llm.ts); it never touches
 * compatibility, which is decided by the rules engine alone.
 */

import { CATEGORIES, CALIBERS, PLATFORMS } from "@/lib/catalog/vocabulary";
import { inchesToMm } from "@/lib/units";

export type ScopeIntent = "search" | "recommend" | "explain" | "compare";

export interface StructuredQuery {
  intent: ScopeIntent;
  q?: string;
  categorySlug?: string;
  platform?: string;
  caliber?: string;
  maxPriceCents?: number;
  maxWeightGrams?: number;
  minLengthMm?: number;
  maxLengthMm?: number;
  verificationStatus?: "VERIFIED_MANUFACTURER";
  sort?: "relevance" | "price-asc" | "weight-asc";
  /** Slots the user says they already own, so SCOPE stops recommending them. */
  ownedCategorySlugs: string[];
  /** Follow-up questions SCOPE should ask before recommending. */
  clarifications: string[];
}

const CATEGORY_SYNONYMS: Array<[RegExp, string]> = [
  [/\bupper\s*receivers?\b|\bupper\b/i, "upper-receiver"],
  [/\blower\s*receivers?\b|\blower\b/i, "lower-receiver"],
  [/\breceivers?\b/i, "receiver"],
  [/\bbarrels?\b/i, "barrel"],
  [/\bhand\s*guards?\b|\brail\s*system\b/i, "handguard"],
  [/\bmuzzle\s*(?:device|brake|comp\w*)\b|\bflash\s*hider\b/i, "muzzle-device"],
  [/\bsuppressors?\b|\bsilencers?\b/i, "suppressor"],
  [/\bbolt\s*carrier\s*groups?\b|\bbcgs?\b/i, "bolt-carrier-group"],
  [/\bcharging\s*handles?\b/i, "charging-handle"],
  [/\btriggers?\b/i, "trigger"],
  [/\bstocks?\b|\bbraces?\b/i, "stock"],
  [/\bgrips?\b/i, "grip"],
  [/\bbuffers?\b|\breceiver\s*extensions?\b/i, "buffer-system"],
  [/\boptics?\b|\bred\s*dots?\b|\bscopes?\b|\blpvos?\b|\bsights?\b/i, "optic"],
  [/\bmounts?\b|\brings?\b/i, "mount"],
  [/\bbipods?\b/i, "bipod"],
  [/\blights?\b|\bweapon\s*lights?\b|\bflashlights?\b/i, "light"],
  [/\bslings?\b|\bqd\s*(?:socket|mount)s?\b/i, "sling-hardware"],
  [/\baccessor(?:y|ies)\b|\brail\s*panels?\b/i, "accessory"],
];

const CALIBER_SYNONYMS: Array<[RegExp, string]> = [
  [/\b5\.?56\b|\b223\s*wylde\b|\b\.223\b/i, "5.56x45mm NATO"],
  [/\b300\s*(?:blk|blackout)\b/i, "300 BLK"],
  [/\b6\.?5\s*creedmoor\b|\b6\.?5cm\b/i, "6.5 Creedmoor"],
  [/\b\.?308\b|\b7\.62x51\b/i, ".308 Winchester"],
  [/\b7\.62x39\b/i, "7.62x39mm"],
  [/\b9\s*mm\b|\b9x19\b/i, "9x19mm"],
  [/\b\.?22\s*lr\b/i, "22 LR"],
];

const PLATFORM_SYNONYMS: Array<[RegExp, string]> = [
  [/\bar-?15\b|\bsmall\s*frame\b|\bm4\b/i, "ar15"],
  [/\bar-?10\b|\blarge\s*frame\b|\bsr-?25\b/i, "ar10"],
];

export function detectCategory(text: string): string | undefined {
  for (const [pattern, slug] of CATEGORY_SYNONYMS) {
    if (pattern.test(text)) return CATEGORIES.some((c) => c.slug === slug) ? slug : undefined;
  }
  return undefined;
}

export function detectCaliber(text: string): string | undefined {
  for (const [pattern, caliber] of CALIBER_SYNONYMS) {
    if (pattern.test(text)) return CALIBERS.includes(caliber as (typeof CALIBERS)[number]) ? caliber : undefined;
  }
  return undefined;
}

export function detectPlatform(text: string): string | undefined {
  for (const [pattern, slug] of PLATFORM_SYNONYMS) {
    if (pattern.test(text)) return PLATFORMS.some((p) => p.slug === slug) ? slug : undefined;
  }
  return undefined;
}

/** Parse "$1,200", "1200 dollars", "under 900", "budget of $2k". */
export function detectBudgetCents(text: string): number | undefined {
  const patterns = [
    /(?:under|below|less than|max(?:imum)?|budget(?:\s+of)?|around|about)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k\b)?/i,
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k\b)?/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = Number.parseFloat(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const multiplier = match[2] ? 1000 : 1;
    return Math.round(value * multiplier * 100);
  }
  return undefined;
}

/** Parse a length in inches, tolerating "11.5 barrel" and `15"`. */
export function detectLengthMm(text: string): { minMm: number; maxMm: number } | undefined {
  const match =
    /(\d+(?:\.\d+)?)\s*(?:in\b|inch(?:es)?\b|"|”)/i.exec(text) ??
    /(\d+(?:\.\d+)?)\s*(?:barrel|handguard|hand\s*guard|rail)/i.exec(text) ??
    /(?:barrel|handguard|hand\s*guard|rail)\s*(?:of\s*)?(\d+(?:\.\d+)?)\b/i.exec(text);
  if (!match) return undefined;
  const inches = Number.parseFloat(match[1]);
  if (!Number.isFinite(inches) || inches <= 0 || inches > 60) return undefined;
  const target = inchesToMm(inches);
  // ±0.4 in tolerance: manufacturers round published lengths differently.
  return { minMm: target - 10, maxMm: target + 10 };
}

const LIGHTWEIGHT = /\blight(?:weight)?\b|\bminimal\s*weight\b|\bas\s+light\b/i;
const BUDGET_FIRST = /\bcheap\w*\b|\bbudget\b|\baffordable\b|\bvalue\b/i;
const VERIFIED_ONLY =
  /\bmanufacturer[-\s]verified\b|\bverified\s+only\b|\bonly\s+verified\b|\bauthoritative\b/i;
const RECOMMEND = /\brecommend\w*\b|\bsuggest\w*\b|\bhelp me\b|\bwhat should\b|\bbuild me\b|\bi want\b/i;
const COMPARE = /\bcompare\b|\bversus\b|\bvs\.?\b|\bdifference between\b/i;
const EXPLAIN = /\bwhy\b|\bexplain\b|\bwhat does\b|\bwhat is\b|\bhow does\b/i;

const OWNED = /\b(?:i (?:already )?(?:own|have|got)|already have)\b([^.?!]*)/i;

export function parseIntent(message: string): StructuredQuery {
  const text = message.trim();

  const intent: ScopeIntent = COMPARE.test(text)
    ? "compare"
    : RECOMMEND.test(text)
      ? "recommend"
      : EXPLAIN.test(text)
        ? "explain"
        : "search";

  const category = detectCategory(text);
  const platform = detectPlatform(text);
  const caliber = detectCaliber(text);
  const budgetCents = detectBudgetCents(text);
  const length = detectLengthMm(text);

  const ownedCategorySlugs: string[] = [];
  const ownedMatch = OWNED.exec(text);
  if (ownedMatch) {
    for (const [pattern, slug] of CATEGORY_SYNONYMS) {
      if (pattern.test(ownedMatch[1])) ownedCategorySlugs.push(slug);
    }
  }

  const clarifications: string[] = [];
  if (intent === "recommend") {
    if (!platform) clarifications.push("Which platform are you configuring?");
    if (!caliber && (!category || category === "barrel" || category === "bolt-carrier-group")) {
      clarifications.push("Which caliber should the configuration be chambered in?");
    }
    if (!budgetCents) clarifications.push("What is your approximate budget?");
    if (ownedCategorySlugs.length === 0) {
      clarifications.push("Which components do you already own?");
    }
  }

  return {
    intent,
    q: text,
    categorySlug: category,
    platform,
    caliber,
    maxPriceCents: budgetCents,
    maxWeightGrams: undefined,
    minLengthMm: length?.minMm,
    maxLengthMm: length?.maxMm,
    verificationStatus: VERIFIED_ONLY.test(text) ? "VERIFIED_MANUFACTURER" : undefined,
    sort: LIGHTWEIGHT.test(text) ? "weight-asc" : BUDGET_FIRST.test(text) ? "price-asc" : "relevance",
    ownedCategorySlugs,
    clarifications,
  };
}

/** Strip filter words so the free-text portion matches product names better. */
export function searchTermsFrom(query: StructuredQuery): string | undefined {
  if (!query.q) return undefined;
  const stripped = query.q
    .replace(/\b(?:i want|show me|find|looking for|recommend|suggest|please|a|an|the|for|with|under|budget|around|about)\b/gi, " ")
    .replace(/\$\s*[\d,]+(?:\.\d+)?k?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length >= 2 ? stripped : undefined;
}
