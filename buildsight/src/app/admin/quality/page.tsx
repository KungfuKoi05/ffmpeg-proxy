import type { Metadata } from "next";
import Link from "next/link";
import { catalogHealth, lowestQualityProducts } from "@/server/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { daysAgo } from "@/lib/pricing/history";

export const metadata: Metadata = { title: "Data quality · Admin" };

export default async function AdminQualityPage() {
  const [health, worst, missingSource, staleVerification, duplicates] = await Promise.all([
    catalogHealth(),
    lowestQualityProducts(30),
    prisma.product.count({ where: { sourceUrl: null } }),
    prisma.product.count({ where: { OR: [{ lastVerified: null }, { lastVerified: { lt: daysAgo(365) } }] } }),
    prisma.product.groupBy({
      by: ["manufacturerId", "manufacturerPartNumber"],
      _count: { _all: true },
      having: { manufacturerPartNumber: { _count: { gt: 1 } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Data quality</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Automated checks run on every catalog write. Nothing here is auto-corrected: a missing
          measurement stays missing and is reported to users as &ldquo;Not provided by
          manufacturer.&rdquo;
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Check label="Missing source URL" count={missingSource} />
        <Check label="Not manufacturer-verified" count={health.notManufacturerVerified} />
        <Check label="Missing dimensions" count={health.missingDimensions} />
        <Check label="Missing pricing" count={health.missingPrices} />
        <Check label="Duplicate SKUs" count={duplicates.length} />
        <Check label="Expired price checks" count={health.expiredPrices} />
        <Check label="Stale verification (>1y)" count={staleVerification} />
        <Check label="Drafts" count={health.drafts} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lowest scoring products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {worst.map((product) => (
            <div key={product.id} className="rounded border border-line bg-elevated p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-xs text-ink hover:text-accent"
                >
                  {product.productName}
                </Link>
                <span
                  className={
                    product.score >= 85
                      ? "font-mono text-xs text-signal-green"
                      : product.score >= 60
                        ? "font-mono text-xs text-signal-yellow"
                        : "font-mono text-xs text-signal-red"
                  }
                >
                  {product.score}
                </span>
              </div>
              <Meter
                className="mt-1.5"
                value={product.score}
                tone={product.score >= 85 ? "green" : product.score >= 60 ? "yellow" : "red"}
              />
              <ul className="mt-2 space-y-0.5">
                {product.issues.slice(0, 4).map((issue) => (
                  <li key={`${issue.code}-${issue.field}`} className="text-[11px] text-ink-faint">
                    {issue.severity} · {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Check({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone?: "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="label-micro">{label}</p>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="font-mono text-2xl text-ink">{count}</span>
          {count > 0 && tone !== "neutral" ? <Badge tone="yellow">Review</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
