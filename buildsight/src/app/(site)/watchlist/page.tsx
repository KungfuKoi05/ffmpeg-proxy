import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { productInclude } from "@/server/products";
import { serializeProduct } from "@/server/serializers";
import { daysAgo, summarizePriceHistory } from "@/lib/pricing/history";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { WatchlistItemActions } from "@/components/watchlist-item-actions";
import { formatMoney } from "@/lib/units";
import { entitlements } from "@/lib/plans";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const plan = entitlements(user.plan);
  const items = await prisma.watchlistItem.findMany({
    where: { ownerId: user.id },
    include: { product: { include: productInclude } },
    orderBy: { createdAt: "desc" },
  });

  const windowDays = Math.min(90, plan.priceHistoryDays);
  const since = daysAgo(windowDays);
  const histories = await prisma.price.findMany({
    where: { productId: { in: items.map((item) => item.productId) }, observedAt: { gte: since } },
    orderBy: { observedAt: "asc" },
    select: { productId: true, amountCents: true, salePriceCents: true, observedAt: true },
  });

  const byProduct = new Map<string, Array<{ observedAt: string; amountCents: number }>>();
  for (const price of histories) {
    const list = byProduct.get(price.productId) ?? [];
    list.push({
      observedAt: price.observedAt.toISOString(),
      amountCents: price.salePriceCents ?? price.amountCents,
    });
    byProduct.set(price.productId, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} watched component{items.length === 1 ? "" : "s"}
            {plan.maxWatchlistItems === null ? "" : ` of ${plan.maxWatchlistItems} on your plan`}.
            {plan.priceTracking
              ? " You will be notified in-app and by email when an observed price moves."
              : " Price change notifications are a Pro feature."}
          </p>
        </div>
        <Link href="/catalog">
          <Button size="sm" variant="secondary">
            Browse catalog
          </Button>
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing on your watchlist"
            description="Open a product and choose “Watch price” to track observed retail pricing."
            action={
              <Link href="/catalog">
                <Button size="sm" variant="primary">
                  Browse the catalog
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => {
            const product = serializeProduct(item.product);
            const statistics = summarizePriceHistory(byProduct.get(item.productId) ?? []);
            const current = product.currentPriceCents ?? product.msrpCents;
            const hitTarget =
              item.targetPriceCents !== null &&
              current !== null &&
              current <= item.targetPriceCents;
            const movement =
              item.lastSeenPriceCents !== null && current !== null
                ? current - item.lastSeenPriceCents
                : null;

            return (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/catalog/${product.slug}`}>
                      <p className="truncate text-sm font-medium text-ink hover:text-accent">
                        {product.productName}
                      </p>
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {product.manufacturerName} · {product.manufacturerPartNumber}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {hitTarget ? <Badge tone="green">At or below target</Badge> : null}
                      {movement !== null && movement !== 0 ? (
                        <Badge tone={movement < 0 ? "green" : "yellow"}>
                          {movement < 0 ? "↓" : "↑"} {formatMoney(Math.abs(movement))} since added
                        </Badge>
                      ) : null}
                      {statistics.lowestCents !== null ? (
                        <span className="font-mono text-[10px] text-ink-faint">
                          {windowDays}-day low {formatMoney(statistics.lowestCents)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-sm text-ink">
                      {current === null ? "No price observed" : formatMoney(current)}
                    </p>
                    {item.targetPriceCents !== null ? (
                      <p className="font-mono text-[10px] text-ink-faint">
                        target {formatMoney(item.targetPriceCents)}
                      </p>
                    ) : null}
                  </div>

                  <WatchlistItemActions
                    productId={item.productId}
                    targetPriceCents={item.targetPriceCents}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
