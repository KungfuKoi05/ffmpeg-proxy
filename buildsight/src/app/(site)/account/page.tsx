import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataRow, Meter } from "@/components/ui/misc";
import { ManageBillingButton, UpgradeButton } from "@/components/plan-actions";
import { entitlements, PLANS } from "@/lib/plans";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { checkout } = await searchParams;
  const plan = entitlements(user.plan);

  const [record, buildCount, watchCount, comparisonCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, stripeCustomerId: true, planRenewsAt: true },
    }),
    prisma.build.count({ where: { ownerId: user.id, isArchived: false } }),
    prisma.watchlistItem.count({ where: { ownerId: user.id } }),
    prisma.savedComparison.count({ where: { ownerId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Account</h1>

      {checkout === "success" ? (
        <p className="mt-4 rounded border border-signal-green/40 bg-signal-green/10 px-3 py-2 text-xs text-signal-green">
          Checkout complete. Your plan updates as soon as the subscription webhook is processed.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DataRow label="Name" value={user.name ?? "—"} />
            <DataRow label="Email" value={user.email} />
            <DataRow label="Role" value={user.role} />
            <DataRow label="Member since" value={formatDate(record?.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg text-ink">{plan.name}</span>
              <Badge tone="accent">{user.plan}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{plan.tagline}</p>

            <div className="mt-4 space-y-3">
              <Usage
                label="Saved builds"
                used={buildCount}
                limit={plan.maxBuilds}
              />
              <Usage label="Watchlist" used={watchCount} limit={plan.maxWatchlistItems} />
              <Usage
                label="Saved comparisons"
                used={comparisonCount}
                limit={plan.maxSavedComparisons}
              />
            </div>

            <div className="mt-4 space-y-2">
              {user.plan === "FREE" ? (
                <>
                  <UpgradeButton
                    plan="PRO"
                    label={`Upgrade to Pro — ${PLANS.PRO.priceCents! / 100} / mo`}
                    disabled={!isBillingConfigured()}
                  />
                  <UpgradeButton
                    plan="PRO_PLUS"
                    label="Upgrade to Pro+"
                    variant="secondary"
                    disabled={!isBillingConfigured()}
                  />
                </>
              ) : record?.stripeCustomerId ? (
                <ManageBillingButton />
              ) : (
                <p className="text-[11px] text-ink-faint">
                  This account&rsquo;s plan was set directly rather than through checkout.
                </p>
              )}
              <Link href="/pricing" className="block">
                <Button variant="ghost" className="w-full">
                  Compare plans
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-ink-muted">
          <p>
            Configurations can be exported at any time as a JSON configuration file, a CSV parts
            list, or a PDF build sheet from the build sheet page.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/builds">
              <Button size="sm" variant="secondary">
                My builds
              </Button>
            </Link>
            <Link href="/watchlist">
              <Button size="sm" variant="ghost">
                Watchlist
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit === null ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label-micro">{label}</span>
        <span className="font-mono text-[11px] text-ink-muted">
          {used} / {limit ?? "∞"}
        </span>
      </div>
      {limit !== null ? (
        <Meter className="mt-1" value={percent} tone={percent > 85 ? "yellow" : "accent"} />
      ) : null}
    </div>
  );
}
