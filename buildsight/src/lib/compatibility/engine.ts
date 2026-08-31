/**
 * Deterministic compatibility engine.
 *
 * Every result comes from an explicit, human-authored `CompatibilityRule` row.
 * There is no inference step and no model in this path: if no rule covers a
 * connection the answer is UNKNOWN, and UNKNOWN is never rendered as
 * compatible anywhere in the product.
 */

import {
  SLOT_BY_KEY,
  slotAdjacency,
  slotLabel,
  CORE_CATEGORIES,
} from "@/lib/assembly/slots";
import { getDimensionMm } from "@/lib/dimensions/access";
import { VERIFICATION_RANK } from "@/lib/catalog/vocabulary";
import type {
  AssemblyComponent,
  AssemblyInput,
  CompatibilityFinding,
  CompatibilityReport,
  CompatibilityRuleInput,
  CompatibilityState,
  ProductFacts,
  VerificationStatus,
} from "@/lib/types";

/** Severity order. UNKNOWN outranks COMPATIBLE so it can never be masked. */
const STATE_SEVERITY: Record<CompatibilityState, number> = {
  INCOMPATIBLE: 4,
  CONDITIONAL: 3,
  UNKNOWN: 2,
  COMPATIBLE: 1,
};

/** Product fields a rule is allowed to compare. */
const COMPARABLE_FIELDS = new Set<keyof ProductFacts>([
  "mountingInterface",
  "threadSpecification",
  "gasSystemCompatibility",
  "handguardInterface",
  "receiverInterface",
  "opticInterface",
  "suppressorCompatibility",
  "barrelCompatibility",
  "platform",
  "caliber",
]);

const FIELD_LABELS: Record<string, string> = {
  mountingInterface: "mounting interface",
  threadSpecification: "thread specification",
  gasSystemCompatibility: "gas system",
  handguardInterface: "handguard interface",
  receiverInterface: "receiver interface",
  opticInterface: "optic interface",
  suppressorCompatibility: "suppressor mounting",
  barrelCompatibility: "barrel interface",
  platform: "platform",
  caliber: "caliber",
};

export function worseState(a: CompatibilityState, b: CompatibilityState): CompatibilityState {
  return STATE_SEVERITY[a] >= STATE_SEVERITY[b] ? a : b;
}

function weakest(...statuses: VerificationStatus[]): VerificationStatus {
  return statuses.reduce((lowest, current) =>
    (VERIFICATION_RANK[current] ?? 0) < (VERIFICATION_RANK[lowest] ?? 0) ? current : lowest,
  );
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function fieldValue(product: ProductFacts, field: string | null): string | null {
  if (!field || !COMPARABLE_FIELDS.has(field as keyof ProductFacts)) return null;
  const value = product[field as keyof ProductFacts];
  return typeof value === "string" ? normalize(value) : null;
}

function describe(component: AssemblyComponent): string {
  return `${component.product.manufacturerName} ${component.product.productName}`;
}

interface CandidatePair {
  subject: AssemblyComponent;
  target: AssemblyComponent;
}

/** Resolve the nearest occupied ancestor slot, skipping empty intermediates. */
function resolveEffectiveParent(
  slotKey: string,
  occupied: Map<string, AssemblyComponent[]>,
): AssemblyComponent | null {
  let current = SLOT_BY_KEY.get(slotKey)?.parent ?? null;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const held = occupied.get(current);
    if (held && held.length > 0) return held[0];
    current = SLOT_BY_KEY.get(current)?.parent ?? null;
  }
  return null;
}

function buildCandidatePairs(
  components: AssemblyComponent[],
  rules: CompatibilityRuleInput[],
): CandidatePair[] {
  const occupied = new Map<string, AssemblyComponent[]>();
  for (const component of components) {
    const list = occupied.get(component.slotKey) ?? [];
    list.push(component);
    occupied.set(component.slotKey, list);
  }

  const pairs: CandidatePair[] = [];
  const seen = new Set<string>();
  const addPair = (subject: AssemblyComponent, target: AssemblyComponent) => {
    if (subject.product.id === target.product.id && subject.slotKey === target.slotKey) return;
    const key = [subject.slotKey, subject.product.id, target.slotKey, target.product.id].join("|");
    const mirror = [target.slotKey, target.product.id, subject.slotKey, subject.product.id].join("|");
    if (seen.has(key) || seen.has(mirror)) return;
    seen.add(key);
    pairs.push({ subject, target });
  };

  // 1. Structural connections from the slot graph.
  const adjacency = new Set(slotAdjacency().map(([parent, child]) => `${parent}>${child}`));
  for (const component of components) {
    const parent = resolveEffectiveParent(component.slotKey, occupied);
    if (parent) addPair(component, parent);
  }
  // Keep the adjacency set referenced for slots whose direct parent is present
  // but whose component was skipped above (multiple components per slot).
  for (const [slotKey, held] of occupied) {
    const parentSlot = SLOT_BY_KEY.get(slotKey)?.parent;
    if (!parentSlot || !adjacency.has(`${parentSlot}>${slotKey}`)) continue;
    const parents = occupied.get(parentSlot) ?? [];
    for (const subject of held) {
      for (const target of parents) addPair(subject, target);
    }
  }

  // 2. Category pairs named by an active rule, even when not structurally
  //    adjacent (e.g. optic footprint vs. mount, barrel vs. gas system).
  const byCategory = new Map<string, AssemblyComponent[]>();
  for (const component of components) {
    const list = byCategory.get(component.product.categorySlug) ?? [];
    list.push(component);
    byCategory.set(component.product.categorySlug, list);
  }
  for (const rule of rules) {
    if (!rule.subjectCategorySlug || !rule.targetCategorySlug) continue;
    const subjects = byCategory.get(rule.subjectCategorySlug) ?? [];
    const targets = byCategory.get(rule.targetCategorySlug) ?? [];
    for (const subject of subjects) {
      for (const target of targets) addPair(subject, target);
    }
  }

  // 3. Explicit product pairs.
  const byProduct = new Map<string, AssemblyComponent>();
  for (const component of components) byProduct.set(component.product.id, component);
  for (const rule of rules) {
    if (!rule.subjectProductId || !rule.targetProductId) continue;
    const subject = byProduct.get(rule.subjectProductId);
    const target = byProduct.get(rule.targetProductId);
    if (subject && target) addPair(subject, target);
  }

  return pairs;
}

function rulesForPair(pair: CandidatePair, rules: CompatibilityRuleInput[]): CompatibilityRuleInput[] {
  const subjectCategory = pair.subject.product.categorySlug;
  const targetCategory = pair.target.product.categorySlug;
  return rules
    .filter((rule) => {
      if (rule.kind === "REQUIRES_COMPONENT" || rule.kind === "MUTUALLY_EXCLUSIVE") return false;
      if (rule.subjectProductId || rule.targetProductId) {
        return (
          (rule.subjectProductId === pair.subject.product.id &&
            rule.targetProductId === pair.target.product.id) ||
          (rule.subjectProductId === pair.target.product.id &&
            rule.targetProductId === pair.subject.product.id)
        );
      }
      if (!rule.subjectCategorySlug || !rule.targetCategorySlug) return false;
      return (
        (rule.subjectCategorySlug === subjectCategory && rule.targetCategorySlug === targetCategory) ||
        (rule.subjectCategorySlug === targetCategory && rule.targetCategorySlug === subjectCategory)
      );
    })
    .sort((a, b) => a.priority - b.priority);
}

/** Orient the pair so the rule's subject category maps to the rule's subject. */
function orient(rule: CompatibilityRuleInput, pair: CandidatePair): CandidatePair {
  if (rule.subjectProductId && rule.subjectProductId === pair.target.product.id) {
    return { subject: pair.target, target: pair.subject };
  }
  if (
    rule.subjectCategorySlug &&
    rule.subjectCategorySlug !== pair.subject.product.categorySlug &&
    rule.subjectCategorySlug === pair.target.product.categorySlug
  ) {
    return { subject: pair.target, target: pair.subject };
  }
  return pair;
}

function evaluateRule(
  rule: CompatibilityRuleInput,
  rawPair: CandidatePair,
): CompatibilityFinding {
  const pair = orient(rule, rawPair);
  const subjectLabel = describe(pair.subject);
  const targetLabel = describe(pair.target);
  const base = {
    id: `${rule.id}:${pair.subject.product.id}:${pair.target.product.id}`,
    subjectSlot: pair.subject.slotKey,
    targetSlot: pair.target.slotKey,
    subjectProductId: pair.subject.product.id,
    targetProductId: pair.target.product.id,
    subjectLabel,
    targetLabel,
    ruleId: rule.id,
    ruleName: rule.name,
    ruleKind: rule.kind,
    condition: rule.condition,
    sourceUrl: rule.sourceUrl,
    confidence: weakest(
      rule.verificationStatus,
      pair.subject.product.verificationStatus,
      pair.target.product.verificationStatus,
    ),
  };

  if (rule.kind === "EXPLICIT_PAIR") {
    return { ...base, state: rule.result, explanation: rule.explanation };
  }

  if (rule.kind === "DIMENSIONAL_CONSTRAINT") {
    return evaluateDimensionalRule(rule, pair, base);
  }

  // Field comparison rules.
  const subjectField = rule.subjectField;
  const targetField = rule.targetField ?? rule.subjectField;
  const subjectValue = fieldValue(pair.subject.product, subjectField);
  const targetValue = fieldValue(pair.target.product, targetField);
  const fieldLabel = FIELD_LABELS[subjectField ?? ""] ?? "interface";

  if (subjectValue === null || targetValue === null) {
    const missing =
      subjectValue === null && targetValue === null
        ? `neither ${subjectLabel} nor ${targetLabel} publishes`
        : subjectValue === null
          ? `${subjectLabel} does not publish`
          : `${targetLabel} does not publish`;
    return {
      ...base,
      state: "UNKNOWN",
      explanation: `Unknown — ${missing} a ${fieldLabel}, so this connection cannot be verified from documentation.`,
    };
  }

  const accepted = (rule.parameters?.acceptedTargetValues ?? []).map((v) => v.toLowerCase());
  if (subjectValue === targetValue || accepted.includes(targetValue)) {
    return {
      ...base,
      state: rule.result,
      explanation: rule.explanation,
    };
  }

  const mismatchResult = rule.parameters?.mismatchResult ?? "INCOMPATIBLE";
  const mismatchExplanation =
    rule.parameters?.mismatchExplanation ??
    `Incompatible — documented ${fieldLabel} differs: ${subjectLabel} publishes "${subjectValue}", ${targetLabel} publishes "${targetValue}".`;
  return { ...base, state: mismatchResult, explanation: mismatchExplanation };
}

function evaluateDimensionalRule(
  rule: CompatibilityRuleInput,
  pair: CandidatePair,
  base: Omit<CompatibilityFinding, "state" | "explanation">,
): CompatibilityFinding {
  const params = rule.parameters ?? {};
  const subjectKey = params.subjectDimension ?? "length";
  const targetKey = params.targetDimension ?? "length";
  const comparison = params.comparison ?? "lte";
  const offset = params.offsetMm ?? 0;

  const subjectValue = getDimensionMm(pair.subject.product, subjectKey);
  const targetValue = getDimensionMm(pair.target.product, targetKey);

  if (subjectValue === null || targetValue === null) {
    return {
      ...base,
      state: "UNKNOWN",
      explanation: `Unknown — ${
        subjectValue === null ? base.subjectLabel : base.targetLabel
      } does not publish the ${subjectValue === null ? subjectKey : targetKey} dimension required to check this constraint.`,
    };
  }

  const threshold = targetValue + offset;
  const holds =
    comparison === "lt"
      ? subjectValue < threshold
      : comparison === "lte"
        ? subjectValue <= threshold
        : comparison === "gt"
          ? subjectValue > threshold
          : subjectValue >= threshold;

  if (holds) return { ...base, state: rule.result, explanation: rule.explanation };

  return {
    ...base,
    state: params.mismatchResult ?? "INCOMPATIBLE",
    explanation:
      params.mismatchExplanation ??
      `Documented dimensional conflict — ${base.subjectLabel} ${subjectKey} is ${subjectValue.toFixed(
        1,
      )} mm against a ${threshold.toFixed(1)} mm limit derived from ${base.targetLabel}.`,
  };
}

function evaluateStructuralRules(
  rule: CompatibilityRuleInput,
  components: AssemblyComponent[],
): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = [];
  const present = new Set(components.map((c) => c.product.categorySlug));

  if (rule.kind === "REQUIRES_COMPONENT") {
    const required = rule.parameters?.requiredCategorySlug;
    if (!required || !rule.subjectCategorySlug) return findings;
    if (!present.has(rule.subjectCategorySlug) || present.has(required)) return findings;
    for (const component of components.filter(
      (c) => c.product.categorySlug === rule.subjectCategorySlug,
    )) {
      findings.push({
        id: `${rule.id}:${component.product.id}:missing-${required}`,
        subjectSlot: component.slotKey,
        targetSlot: required,
        subjectProductId: component.product.id,
        targetProductId: null,
        subjectLabel: describe(component),
        targetLabel: `Missing ${required.replace(/-/g, " ")}`,
        state: rule.result,
        explanation: rule.explanation,
        condition: rule.condition,
        ruleId: rule.id,
        ruleName: rule.name,
        ruleKind: rule.kind,
        confidence: weakest(rule.verificationStatus, component.product.verificationStatus),
        sourceUrl: rule.sourceUrl,
      });
    }
    return findings;
  }

  if (rule.kind === "MUTUALLY_EXCLUSIVE") {
    const exclusive = rule.parameters?.exclusiveCategorySlugs ?? [];
    const hits = components.filter((c) => exclusive.includes(c.product.categorySlug));
    const categoriesHit = new Set(hits.map((c) => c.product.categorySlug));
    if (categoriesHit.size < 2) return findings;
    const [first, second] = hits;
    findings.push({
      id: `${rule.id}:${first.product.id}:${second.product.id}`,
      subjectSlot: first.slotKey,
      targetSlot: second.slotKey,
      subjectProductId: first.product.id,
      targetProductId: second.product.id,
      subjectLabel: describe(first),
      targetLabel: describe(second),
      state: rule.result,
      explanation: rule.explanation,
      condition: rule.condition,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleKind: rule.kind,
      confidence: weakest(
        rule.verificationStatus,
        first.product.verificationStatus,
        second.product.verificationStatus,
      ),
      sourceUrl: rule.sourceUrl,
    });
  }

  return findings;
}

export function evaluateCompatibility(
  input: AssemblyInput,
  allRules: CompatibilityRuleInput[],
): CompatibilityReport {
  const findings: CompatibilityFinding[] = [];
  const presentCategories = new Set(input.components.map((c) => c.product.categorySlug));

  // Fallback rules opt out once a more specific component is in the build.
  const rules = allRules.filter((rule) => {
    const skip = rule.parameters?.skipIfCategoryPresent ?? [];
    return !skip.some((categorySlug) => presentCategories.has(categorySlug));
  });

  const pairs = buildCandidatePairs(input.components, rules);

  for (const pair of pairs) {
    const applicable = rulesForPair(pair, rules);
    if (applicable.length === 0) {
      findings.push({
        id: `no-rule:${pair.subject.product.id}:${pair.target.product.id}`,
        subjectSlot: pair.subject.slotKey,
        targetSlot: pair.target.slotKey,
        subjectProductId: pair.subject.product.id,
        targetProductId: pair.target.product.id,
        subjectLabel: describe(pair.subject),
        targetLabel: describe(pair.target),
        state: "UNKNOWN",
        explanation:
          "Unknown — no documented compatibility rule covers this connection. Add a sourced rule in the admin catalog to resolve it.",
        condition: null,
        ruleId: null,
        ruleName: null,
        ruleKind: null,
        confidence: weakest(
          pair.subject.product.verificationStatus,
          pair.target.product.verificationStatus,
        ),
        sourceUrl: null,
      });
      continue;
    }

    // An EXPLICIT_PAIR rule is authoritative for the pair it names.
    const explicit = applicable.find((rule) => rule.kind === "EXPLICIT_PAIR");
    if (explicit) {
      findings.push(evaluateRule(explicit, pair));
      continue;
    }
    for (const rule of applicable) findings.push(evaluateRule(rule, pair));
  }

  for (const rule of rules) {
    if (rule.kind === "REQUIRES_COMPONENT" || rule.kind === "MUTUALLY_EXCLUSIVE") {
      findings.push(...evaluateStructuralRules(rule, input.components));
    }
  }

  const counts: Record<CompatibilityState, number> = {
    COMPATIBLE: 0,
    INCOMPATIBLE: 0,
    CONDITIONAL: 0,
    UNKNOWN: 0,
  };
  for (const finding of findings) counts[finding.state] += 1;

  const missingCoreCategories = CORE_CATEGORIES.filter((slug) => !presentCategories.has(slug));

  let overall: CompatibilityState = input.components.length === 0 ? "UNKNOWN" : "COMPATIBLE";
  for (const finding of findings) overall = worseState(overall, finding.state);
  if (missingCoreCategories.length > 0) overall = worseState(overall, "UNKNOWN");

  return { overall, findings, counts, missingCoreCategories };
}

/** Convenience used by the catalog UI to check one candidate against a build. */
export function evaluateCandidate(
  input: AssemblyInput,
  candidate: AssemblyComponent,
  rules: CompatibilityRuleInput[],
): CompatibilityReport {
  return evaluateCompatibility(
    { ...input, components: [...input.components, candidate] },
    rules,
  );
}

export { slotLabel };
