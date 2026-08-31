import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompatibilityBadge, VerificationBadge } from "@/components/ui/signal";
import { toggleRuleAction } from "@/server/actions/admin";
import { categoryName } from "@/lib/catalog/vocabulary";
import type { CompatibilityState } from "@/lib/types";

export const metadata: Metadata = { title: "Compatibility rules · Admin" };

export default async function AdminRulesPage() {
  const rules = await prisma.compatibilityRule.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "asc" }, { name: "asc" }],
    include: {
      subjectProduct: { select: { productName: true } },
      targetProduct: { select: { productName: true } },
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compatibility rules</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            These rows are the only thing the engine reasons from. A connection with no matching
            rule resolves UNKNOWN and is never shown as compatible.
          </p>
        </div>
        <Link href="/admin/rules/new">
          <Button size="sm" variant="primary">
            New rule
          </Button>
        </Link>
      </header>

      <div className="space-y-2">
        {rules.map((rule) => (
          <Card key={rule.id} className={rule.isActive ? undefined : "opacity-60"}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{rule.name}</p>
                    <Badge tone="neutral">{rule.kind.replace(/_/g, " ")}</Badge>
                    <CompatibilityBadge state={rule.result as CompatibilityState} />
                    {!rule.isActive ? <Badge tone="gray">Inactive</Badge> : null}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">{rule.explanation}</p>
                  {rule.condition ? (
                    <p className="mt-1 text-xs text-signal-yellow">Condition: {rule.condition}</p>
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] text-ink-faint">
                    {rule.subjectProduct
                      ? `${rule.subjectProduct.productName} → ${rule.targetProduct?.productName ?? "?"}`
                      : `${categoryName(rule.subjectCategorySlug ?? "")} → ${categoryName(
                          rule.targetCategorySlug ?? "",
                        )}`}
                    {rule.subjectField ? ` · compares ${rule.subjectField}` : ""} · priority{" "}
                    {rule.priority}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <VerificationBadge status={rule.verificationStatus} />
                    {rule.sourceUrl ? (
                      <a
                        href={rule.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[10px] text-accent hover:underline"
                      >
                        Source
                      </a>
                    ) : (
                      <span className="text-[10px] text-signal-yellow">No source recorded</span>
                    )}
                  </div>
                </div>

                <form action={toggleRuleAction}>
                  <input type="hidden" name="id" value={rule.id} />
                  <Button type="submit" size="sm" variant={rule.isActive ? "ghost" : "secondary"}>
                    {rule.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
