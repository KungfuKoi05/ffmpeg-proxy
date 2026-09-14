import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing-actions";
import { PLANS, PLAN_ORDER } from "@/lib/config/plans";
import { formatCurrency } from "@/lib/utils";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  const subscription = data as Subscription | null;

  // Usage is read with the service role since usage_events is tenant-read-only.
  const usage = await getUsageSummary(ctx.business.id);

  return (
    <DashboardShell businessName={ctx.business.name} active="/billing">
      <h1 className="text-lg font-semibold tracking-tight">Billing</h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription && subscription.status !== "incomplete" ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{PLANS[subscription.plan].name}</span>
                  <Badge tone={statusTone(subscription.status)}>{subscription.status}</Badge>
                </div>
                <p className="text-slate-600">
                  {formatCurrency(PLANS[subscription.plan].monthlyPrice)} per month
                </p>
                {subscription.current_period_end ? (
                  <p className="text-xs text-slate-500">
                    Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No active subscription. Choose a plan to activate your receptionist.
              </p>
            )}
            <div className="mt-4">
              <BillingActions hasSubscription={Boolean(subscription?.stripe_customer_id)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage this month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Meter label="AI conversations" used={usage.aiConversations.used} limit={usage.aiConversations.limit} />
            <Meter label="SMS segments" used={usage.smsSegments.used} limit={usage.smsSegments.limit} />
            <Meter label="Voice minutes" used={usage.voiceMinutes.used} limit={usage.voiceMinutes.limit} />
            <p className="pt-2 text-xs text-slate-500">
              Estimated usage cost: {formatCurrency(usage.estimatedCostUsd, { cents: true })}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Plans</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const current = subscription?.plan === id;
            return (
              <Card key={id} className={current ? "border-brand-500 ring-1 ring-brand-500" : ""}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{plan.name}</h3>
                    {current ? <Badge tone="info">current</Badge> : null}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-sm font-normal text-slate-500">/mo</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    {plan.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-900">
          {Math.round(used)} / {limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
