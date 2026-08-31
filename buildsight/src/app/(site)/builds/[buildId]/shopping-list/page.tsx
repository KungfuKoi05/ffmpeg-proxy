import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuildForUser, summarizeBuildRecord, toAssemblyInput } from "@/server/builds";
import { buildShoppingList } from "@/lib/export/build-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/units";

export const metadata: Metadata = { title: "Shopping list" };

const AVAILABILITY_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  BACKORDER: "Backorder",
  OUT_OF_STOCK: "Out of stock",
  DISCONTINUED: "Discontinued",
  UNKNOWN: "Unknown",
};

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ buildId: string }>;
}) {
  const user = await getCurrentUser();
  const { buildId } = await params;
  if (!user) redirect(`/sign-in?next=/builds/${buildId}/shopping-list`);

  let build;
  try {
    build = await getBuildForUser(buildId, user.id);
  } catch {
    notFound();
  }

  const summary = await summarizeBuildRecord(build);
  const items = buildShoppingList({
    build: {
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      caliber: build.caliber,
      createdAt: build.createdAt.toISOString(),
      updatedAt: build.updatedAt.toISOString(),
      ownerName: user.name,
    },
    components: toAssemblyInput(build).components,
    summary,
  });

  const total = items.reduce(
    (sum, item) => sum + (item.priceCents ?? 0) * item.quantity,
    0,
  );
  const unpriced = items.filter((item) => item.priceCents === null).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <nav className="mb-4 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        <Link href="/builds" className="hover:text-ink">
          My builds
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/studio/${build.id}`} className="hover:text-ink">
          {build.name}
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Shopping list</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(total, summary.currency)} using the best observed price
            {unpriced > 0 ? ` · ${unpriced} item(s) without observed pricing` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/builds/${build.id}/export?format=csv`} download>
            <Button size="sm" variant="secondary">
              Export CSV
            </Button>
          </a>
          <Link href={`/studio/${build.id}`}>
            <Button size="sm" variant="ghost">
              Back to studio
            </Button>
          </Link>
        </div>
      </header>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <Card key={item.productId}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="label-micro">{item.slot}</p>
                <Link href={`/catalog/${item.slug}`}>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink hover:text-accent">
                    {item.product}
                  </p>
                </Link>
                <p className="text-xs text-ink-muted">
                  {item.manufacturer} · Part {item.partNumber} · Qty {item.quantity}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={item.availability === "IN_STOCK" ? "green" : "neutral"}>
                    {AVAILABILITY_LABEL[item.availability] ?? item.availability}
                  </Badge>
                  {item.regulated ? <Badge tone="yellow">Regulated</Badge> : null}
                </div>
                {item.purchaseNote ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-signal-yellow">
                    {item.purchaseNote}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="font-mono text-sm text-ink">
                  {item.priceCents === null
                    ? "No price observed"
                    : formatMoney(item.priceCents * item.quantity, item.currency)}
                </p>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {item.productUrl ? (
                    <a href={item.productUrl} target="_blank" rel="noreferrer noopener">
                      <Button size="sm" variant="secondary">
                        View product <ExternalLink />
                      </Button>
                    </a>
                  ) : null}
                  {item.manufacturerUrl ? (
                    <a href={item.manufacturerUrl} target="_blank" rel="noreferrer noopener">
                      <Button size="sm" variant="ghost">
                        Manufacturer
                      </Button>
                    </a>
                  ) : null}
                  <Link href={`/catalog?category=${item.slot.toLowerCase().replace(/\s+/g, "-")}`}>
                    <Button size="sm" variant="ghost">
                      Compare
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 rounded border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted">
        BuildSight does not process purchases. Every link goes to the manufacturer&rsquo;s or
        retailer&rsquo;s own product page, and regulated items must be purchased through their
        normal process.
      </p>
    </div>
  );
}
