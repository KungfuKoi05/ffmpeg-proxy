/**
 * SCOPE — the build assistant.
 *
 * SCOPE navigates the verified catalog. It never states a specification that is
 * not in the database and never decides compatibility itself: candidate parts
 * are scored by running the deterministic rules engine against the user's
 * current configuration.
 */

import { classifyRequest, type PolicyDecision } from "@/lib/policy/policy";
import { parseIntent, searchTermsFrom, type StructuredQuery } from "@/lib/scope/intent";
import { refineQueryWithLlm, isLlmConfigured } from "@/lib/scope/llm";
import { searchProducts, toProductFacts } from "@/server/products";
import { serializeProduct, type SerializedProduct } from "@/server/serializers";
import { loadActiveRules } from "@/server/rules";
import { evaluateCompatibility, worseState } from "@/lib/compatibility/engine";
import { slotForCategory } from "@/lib/assembly/slots";
import { categoryName, platformName } from "@/lib/catalog/vocabulary";
import { formatMoney, formatLength, formatMass } from "@/lib/units";
import type { AssemblyInput, CompatibilityState } from "@/lib/types";

export interface ScopeCandidate {
  product: SerializedProduct;
  /** Result of adding this product to the current configuration. */
  compatibility: CompatibilityState | null;
  explanation: string | null;
}

export interface ScopeReply {
  refusal: PolicyDecision | null;
  message: string;
  clarifications: string[];
  filters: Omit<StructuredQuery, "clarifications">;
  candidates: ScopeCandidate[];
  usedLlm: boolean;
  llmAvailable: boolean;
}

const STATE_ORDER: Record<CompatibilityState, number> = {
  COMPATIBLE: 0,
  CONDITIONAL: 1,
  UNKNOWN: 2,
  INCOMPATIBLE: 3,
};

export async function runScope(
  message: string,
  assembly: AssemblyInput | null,
): Promise<ScopeReply> {
  const policy = classifyRequest(message);
  if (!policy.allowed) {
    return {
      refusal: policy,
      message: policy.message,
      clarifications: [],
      filters: { intent: "search", ownedCategorySlugs: [] },
      candidates: [],
      usedLlm: false,
      llmAvailable: isLlmConfigured(),
    };
  }

  const parsed = parseIntent(message);
  const { query, usedLlm } = await refineQueryWithLlm(message, parsed);
  const { clarifications, ...filters } = query;

  const result = await searchProducts({
    q: searchTermsFrom(query),
    categorySlug: query.categorySlug,
    platform: query.platform,
    caliber: query.caliber,
    verificationStatus: query.verificationStatus,
    maxPriceCents: query.maxPriceCents,
    maxWeightGrams: query.maxWeightGrams,
    minLengthMm: query.minLengthMm,
    maxLengthMm: query.maxLengthMm,
    sort: query.sort === "relevance" ? undefined : query.sort,
    pageSize: 8,
  });

  const rules = assembly ? await loadActiveRules() : [];
  const candidates: ScopeCandidate[] = result.products.map((product) => {
    const serialized = serializeProduct(product);
    if (!assembly) return { product: serialized, compatibility: null, explanation: null };

    const facts = toProductFacts(product);
    const slotKey = slotForCategory(facts.categorySlug)?.key;
    if (!slotKey) return { product: serialized, compatibility: null, explanation: null };

    // Replace anything already occupying the slot so the check reflects a swap.
    const components = assembly.components.filter((component) => component.slotKey !== slotKey);
    const report = evaluateCompatibility(
      { ...assembly, components: [...components, { slotKey, quantity: 1, product: facts }] },
      rules,
    );
    const related = report.findings.filter(
      (finding) =>
        finding.subjectProductId === facts.id || finding.targetProductId === facts.id,
    );
    if (related.length === 0) {
      return { product: serialized, compatibility: "UNKNOWN", explanation: null };
    }
    const state = related.reduce<CompatibilityState>(
      (worst, finding) => worseState(worst, finding.state),
      "COMPATIBLE",
    );
    const driver =
      related.find((finding) => finding.state === state) ?? related[0];
    return { product: serialized, compatibility: state, explanation: driver.explanation };
  });

  candidates.sort((a, b) => {
    const aOrder = a.compatibility ? STATE_ORDER[a.compatibility] : 0;
    const bOrder = b.compatibility ? STATE_ORDER[b.compatibility] : 0;
    return aOrder - bOrder;
  });

  return {
    refusal: null,
    message: composeMessage(query, candidates, result.total),
    clarifications,
    filters,
    candidates,
    usedLlm,
    llmAvailable: isLlmConfigured(),
  };
}

/**
 * Compose the reply from database facts only. Every number in the sentence
 * comes from a stored field; nothing is generated.
 */
function composeMessage(
  query: StructuredQuery,
  candidates: ScopeCandidate[],
  total: number,
): string {
  const constraints: string[] = [];
  if (query.categorySlug) constraints.push(categoryName(query.categorySlug).toLowerCase());
  if (query.platform) constraints.push(platformName(query.platform));
  if (query.caliber) constraints.push(query.caliber);
  if (query.maxPriceCents) constraints.push(`under ${formatMoney(query.maxPriceCents, "USD", { showCents: false })}`);
  if (query.minLengthMm && query.maxLengthMm) {
    const midpoint = (query.minLengthMm + query.maxLengthMm) / 2;
    constraints.push(`around ${formatLength(midpoint)}`);
  }
  if (query.verificationStatus === "VERIFIED_MANUFACTURER") {
    constraints.push("manufacturer-verified records only");
  }

  const scope = constraints.length ? ` matching ${constraints.join(", ")}` : "";

  if (candidates.length === 0) {
    return `I could not find any catalog records${scope}. I only search verified records in this catalog — I do not estimate specifications that a manufacturer has not published.`;
  }

  const lead = `Found ${total} catalog record${total === 1 ? "" : "s"}${scope}. Showing ${candidates.length}.`;
  const best = candidates[0];
  const detail: string[] = [];
  if (best.product.weightGrams !== null) {
    detail.push(`weighs ${formatMass(best.product.weightGrams)}`);
  }
  const price = best.product.currentPriceCents ?? best.product.msrpCents;
  if (price !== null) detail.push(`is listed at ${formatMoney(price)}`);

  const highlight = detail.length
    ? ` ${best.product.manufacturerName} ${best.product.productName} ${detail.join(" and ")}.`
    : "";

  const compatibilityNote =
    best.compatibility === null
      ? " Open a configuration to have each candidate checked against it."
      : best.compatibility === "COMPATIBLE"
        ? " Against your current configuration it resolves compatible from documented rules."
        : best.compatibility === "UNKNOWN"
          ? " Compatibility against your configuration is unknown — no documented rule covers that connection."
          : ` Against your current configuration it resolves ${best.compatibility.toLowerCase()}.`;

  return `${lead}${highlight}${compatibilityNote}`;
}
