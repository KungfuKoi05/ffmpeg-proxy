import type { Metadata } from "next";
import Link from "next/link";
import { catalogHealth } from "@/server/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/misc";
import { formatRelative } from "@/lib/utils";
import { PriceCheckRunner } from "@/components/admin/job-runner";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [health, recentAudit, recentProducts] = await Promise.all([
    catalogHealth(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { email: true } } },
    }),
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { manufacturer: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Catalog overview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everything published here is visible to users. Records without a source URL cannot be
          published.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={health.products} sub={`${health.published} published`} />
        <Stat label="Manufacturers" value={health.manufacturers} />
        <Stat label="Active rules" value={health.rules} />
        <Stat label="Retailers" value={health.retailers} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-3xl text-ink">{health.averageQuality ?? "—"}</span>
              <span className="label-micro">average score</span>
            </div>
            <Meter
              className="mt-2"
              value={health.averageQuality ?? 0}
              tone={
                (health.averageQuality ?? 0) >= 85
                  ? "green"
                  : (health.averageQuality ?? 0) >= 60
                    ? "yellow"
                    : "red"
              }
            />
            <ul className="mt-4 space-y-1.5 text-xs">
              <Issue
                label="Not manufacturer-verified"
                count={health.notManufacturerVerified}
                href="/admin/quality"
              />
              <Issue label="Missing dimensions" count={health.missingDimensions} href="/admin/quality" />
              <Issue label="Missing pricing" count={health.missingPrices} href="/admin/quality" />
              <Issue label="Duplicate SKUs" count={health.duplicateSkus} href="/admin/quality" />
              <Issue label="Expired price checks" count={health.expiredPrices} href="/admin/quality" />
              <Issue label="Drafts awaiting publish" count={health.drafts} href="/admin/products" />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingestion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl text-ink">{health.pendingImportRecords}</p>
            <p className="mt-1 text-xs text-ink-muted">
              records awaiting human review. Approved records are created as drafts, never published
              automatically.
            </p>
            <Link
              href="/admin/imports"
              className="mt-3 inline-block text-xs text-accent hover:underline"
            >
              Open the ingestion queue
            </Link>

            <div className="mt-4 border-t border-line pt-3">
              <p className="label-micro mb-2">Scheduled jobs</p>
              <PriceCheckRunner />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Compares watched products against their last-seen observation and raises
                notifications. A scheduler can call the same endpoint with a job token.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently updated products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProducts.map((product) => (
              <Link
                key={product.id}
                href={`/admin/products/${product.id}`}
                className="flex items-center justify-between gap-3 rounded border border-line bg-elevated px-3 py-2 hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink">{product.productName}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {product.manufacturer.name} · {product.manufacturerPartNumber}
                  </p>
                </div>
                <Badge tone={product.publishState === "PUBLISHED" ? "green" : "yellow"}>
                  {product.publishState}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recentAudit.length === 0 ? (
              <p className="text-xs text-ink-muted">No activity recorded yet.</p>
            ) : (
              recentAudit.map((entry) => (
                <div key={entry.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate text-ink-muted">
                    <span className="font-mono text-ink">{entry.action}</span>{" "}
                    {entry.actor?.email ?? "system"}
                  </span>
                  <span className="shrink-0 text-ink-faint">{formatRelative(entry.createdAt)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="label-micro">{label}</p>
        <p className="mt-1 font-mono text-2xl text-ink">{value.toLocaleString()}</p>
        {sub ? <p className="text-[11px] text-ink-faint">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function Issue({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <li className="flex items-center justify-between">
      <Link href={href} className="text-ink-muted hover:text-ink">
        {label}
      </Link>
      <span className={count > 0 ? "font-mono text-signal-yellow" : "font-mono text-ink-faint"}>
        {count}
      </span>
    </li>
  );
}
