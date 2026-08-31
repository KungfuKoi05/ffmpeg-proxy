import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/plan-actions";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { formatMoney } from "@/lib/units";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const user = await getCurrentUser();
  const billingConfigured = isBillingConfigured();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
          The catalog, the compatibility engine and the 3D viewer are on every plan. Paid plans add
          scale: more configurations, longer price history and richer exports.
        </p>
      </header>

      {!billingConfigured ? (
        <p className="mx-auto mt-6 max-w-2xl rounded border border-line bg-surface px-4 py-3 text-center text-xs text-ink-muted">
          Billing is not configured on this deployment. Plans are shown for reference; checkout is
          disabled until Stripe keys are set.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const current = user?.plan === plan.id;
          return (
            <Card key={plan.id} className={current ? "border-accent/50" : undefined}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-wider text-accent">
                    {plan.name}
                  </p>
                  {current ? <Badge tone="accent">Current</Badge> : null}
                </div>
                <p className="mt-3 text-3xl font-semibold">
                  {plan.priceCents === null
                    ? "Custom"
                    : plan.priceCents === 0
                      ? "Free"
                      : formatMoney(plan.priceCents, "USD", { showCents: false })}
                  {plan.priceCents ? (
                    <span className="text-xs font-normal text-ink-faint">/month</span>
                  ) : null}
                </p>
                <p className="mt-2 text-xs text-ink-muted">{plan.tagline}</p>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-xs text-ink-muted">
                      <span className="text-accent">·</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {plan.id === "FREE" ? (
                    <Link href={user ? "/studio" : "/sign-up"}>
                      <Button variant="secondary" className="w-full">
                        {user ? "Open Build Studio" : "Start free"}
                      </Button>
                    </Link>
                  ) : plan.id === "BUSINESS" ? (
                    <a href="mailto:sales@buildsight.example">
                      <Button variant="outline" className="w-full">
                        Contact sales
                      </Button>
                    </a>
                  ) : !user ? (
                    <Link href="/sign-up">
                      <Button variant="primary" className="w-full">
                        Create an account
                      </Button>
                    </Link>
                  ) : current ? (
                    <Button variant="ghost" className="w-full" disabled>
                      Current plan
                    </Button>
                  ) : (
                    <UpgradeButton
                      plan={plan.id as "PRO" | "PRO_PLUS"}
                      label={`Upgrade to ${plan.name}`}
                      disabled={!billingConfigured}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="mt-10 overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-elevated">
            <tr>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Limit
              </th>
              {PLAN_ORDER.map((planId) => (
                <th
                  key={planId}
                  className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                >
                  {PLANS[planId].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <LimitRow label="Saved builds" values={PLAN_ORDER.map((id) => PLANS[id].maxBuilds)} />
            <LimitRow
              label="Watchlist items"
              values={PLAN_ORDER.map((id) => PLANS[id].maxWatchlistItems)}
            />
            <LimitRow
              label="Builds per comparison"
              values={PLAN_ORDER.map((id) => PLANS[id].compareLimit)}
            />
            <LimitRow
              label="Price history"
              values={PLAN_ORDER.map((id) => `${PLANS[id].priceHistoryDays} days`)}
            />
            <LimitRow label="PDF build sheets" values={PLAN_ORDER.map((id) => PLANS[id].pdfExport)} />
            <LimitRow label="Price tracking" values={PLAN_ORDER.map((id) => PLANS[id].priceTracking)} />
            <LimitRow
              label="Advanced visualization"
              values={PLAN_ORDER.map((id) => PLANS[id].advancedVisualization)}
            />
            <LimitRow
              label="Manufacturer portal"
              values={PLAN_ORDER.map((id) => PLANS[id].manufacturerPortal)}
            />
          </tbody>
        </table>
      </section>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-ink-faint">
        BuildSight does not sell firearms or components and does not automate the purchase of
        regulated products. Paid plans cover access to the platform&rsquo;s catalog, engines and
        exports.
      </p>
    </div>
  );
}

function LimitRow({
  label,
  values,
}: {
  label: string;
  values: Array<number | string | boolean | null>;
}) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2 text-ink-faint">{label}</td>
      {values.map((value, index) => (
        <td key={index} className="px-4 py-2 font-mono text-ink">
          {value === null
            ? "Unlimited"
            : typeof value === "boolean"
              ? value
                ? "Yes"
                : "—"
              : String(value)}
        </td>
      ))}
    </tr>
  );
}
