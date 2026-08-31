import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { listBuilds, summarizeBuildRecord } from "@/server/builds";
import { productInclude } from "@/server/products";
import { serializeProduct } from "@/server/serializers";
import { BuildCard } from "@/components/build-card";
import { ProductCard } from "@/components/catalog/product-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, Meter } from "@/components/ui/misc";
import { entitlements } from "@/lib/plans";
import { formatMoney } from "@/lib/units";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [builds, watchlist, recent, comparisons, notifications] = await Promise.all([
    listBuilds(user.id),
    prisma.watchlistItem.findMany({
      where: { ownerId: user.id },
      include: { product: { include: productInclude } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.recentlyViewedProduct.findMany({
      where: { ownerId: user.id },
      include: { product: { include: productInclude } },
      orderBy: { viewedAt: "desc" },
      take: 6,
    }),
    prisma.savedComparison.findMany({
      where: { ownerId: user.id },
      include: { entries: { include: { build: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.notification.findMany({
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const summaries = await Promise.all(
    builds.slice(0, 6).map(async (build) => ({
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      isArchived: build.isArchived,
      updatedAt: build.updatedAt.toISOString(),
      summary: await summarizeBuildRecord(build),
    })),
  );

  const plan = entitlements(user.plan);
  const buildUsage = plan.maxBuilds === null ? null : (builds.length / plan.maxBuilds) * 100;
  const totalPlanned = summaries.reduce(
    (sum, build) => sum + (build.summary.cost.totalCurrentCents ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {user.name ? `Welcome back, ${user.name}` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {builds.length} saved configuration{builds.length === 1 ? "" : "s"} ·{" "}
            {watchlist.length} watched component{watchlist.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(totalPlanned, "USD", { showCents: false })} planned across shown builds
          </p>
        </div>
        <Link href="/studio">
          <Button variant="primary" size="sm">
            New configuration
          </Button>
        </Link>
      </header>

      {notifications.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded border border-line bg-elevated p-3">
                <p className="text-xs font-medium text-ink">{notification.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{notification.body}</p>
                {notification.href ? (
                  <Link href={notification.href} className="mt-1 inline-block text-[11px] text-accent hover:underline">
                    Open
                  </Link>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold tracking-tight">My builds</h2>
          <Link href="/builds" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        {buildUsage !== null ? (
          <div className="mt-2 max-w-sm">
            <div className="flex items-baseline justify-between">
              <span className="label-micro">Plan usage</span>
              <span className="font-mono text-[11px] text-ink-muted">
                {builds.length} / {plan.maxBuilds}
              </span>
            </div>
            <Meter className="mt-1" value={buildUsage} tone={buildUsage > 85 ? "yellow" : "accent"} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                title="No configurations yet"
                description="Open the Build Studio, add a receiver and a barrel, and BuildSight will check documented compatibility as you go."
                action={
                  <Link href="/studio">
                    <Button size="sm" variant="primary">
                      Open Build Studio
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            summaries.map((build) => <BuildCard key={build.id} build={build} />)
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Watchlist</h2>
            <Link href="/watchlist" className="text-xs text-accent hover:underline">
              Manage
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {watchlist.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Nothing watched yet. Open a product and choose &ldquo;Watch price&rdquo;.
              </p>
            ) : (
              watchlist.map((item) => (
                <ProductCard key={item.id} product={serializeProduct(item.product)} />
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold tracking-tight">Recently viewed</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {recent.length === 0 ? (
              <p className="text-xs text-ink-muted">Products you open will appear here.</p>
            ) : (
              recent.map((item) => (
                <ProductCard key={item.id} product={serializeProduct(item.product)} />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Saved comparisons</h2>
          <Link href="/compare" className="text-xs text-accent hover:underline">
            Compare builds
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {comparisons.length === 0 ? (
            <p className="text-xs text-ink-muted">
              Save a comparison from the compare view to pin it here.
            </p>
          ) : (
            comparisons.map((comparison) => (
              <Link
                key={comparison.id}
                href={`/compare?builds=${comparison.entries.map((entry) => entry.buildId).join(",")}`}
                className="block rounded border border-line bg-surface px-3 py-2 text-xs text-ink-muted hover:border-line-strong hover:text-ink"
              >
                {comparison.name} —{" "}
                {comparison.entries.map((entry) => entry.build.name).join(" vs ")}
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
