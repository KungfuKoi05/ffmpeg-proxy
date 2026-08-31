import { prisma } from "@/lib/db";
import type { CompatibilityRuleInput, RuleParameters } from "@/lib/types";
import type { CompatibilityRule } from "@prisma/client";

export function toRuleInput(rule: CompatibilityRule): CompatibilityRuleInput {
  return {
    id: rule.id,
    kind: rule.kind,
    name: rule.name,
    subjectCategorySlug: rule.subjectCategorySlug,
    targetCategorySlug: rule.targetCategorySlug,
    subjectProductId: rule.subjectProductId,
    targetProductId: rule.targetProductId,
    subjectField: rule.subjectField,
    targetField: rule.targetField,
    parameters: (rule.parameters as RuleParameters | null) ?? null,
    result: rule.result,
    explanation: rule.explanation,
    condition: rule.condition,
    sourceUrl: rule.sourceUrl,
    verificationStatus: rule.verificationStatus,
    priority: rule.priority,
  };
}

/** All active rules. The set is small and read on every build evaluation. */
export async function loadActiveRules(): Promise<CompatibilityRuleInput[]> {
  const rules = await prisma.compatibilityRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });
  return rules.map(toRuleInput);
}
