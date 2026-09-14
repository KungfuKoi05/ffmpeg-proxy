import { requireSuperAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge, statusTone } from "@/components/ui/badge";
import { allFeatureFlags } from "@/lib/config/features";
import { PLANS } from "@/lib/config/plans";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { isPlanId } from "@/lib/config/plans";

export const dynamic = "force-dynamic";

/** Platform admin (section 26). super_admin only; never renders secrets. */
export default async function AdminPage() {
  await requireSuperAdmin();
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: businesses },
    { data: subscriptions },
    { data: leads },
    { data: appointments },
    { data: usage },
    { data: failures },
    { data: audits },
  ] = await Promise.all([
    db.from("businesses").select("id, name, created_at, ai_enabled, onboarding_completed").order("created_at", { ascending: false }),
    db.from("subscriptions").select("business_id, plan, status"),
    db.from("leads").select("status, estimated_value"),
    db.from("appointments").select("id"),
    db.from("usage_events").select("estimated_cost, event_type").gte("created_at", since),
    db.from("ai_actions").select("agent, action, error").eq("success", false).gte("created_at", since).limit(50),
    db.from("audit_logs").select("action, created_at, business_id").order("created_at", { ascending: false }).limit(20),
  ]);

  const active = (subscriptions ?? []).filter((s) => s.status === "active");
  const mrr = active.reduce(
    (sum, s) => sum + (isPlanId(s.plan) ? PLANS[s.plan].monthlyPrice : 0),
    0,
  );
  const estimatedRevenue = (leads ?? [])
    .filter((l) => l.status === "booked" || l.status === "completed")
    .reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);
  const apiCost = (usage ?? []).reduce((sum, u) => sum + Number(u.estimated_cost ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold">Platform admin</span>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Businesses" value={String(businesses?.length ?? 0)} />
          <Stat label="Active subscriptions" value={String(active.length)} />
          <Stat label="MRR" value={formatCurrency(mrr)} emphasis />
          <Stat label="API cost (7d)" value={formatCurrency(apiCost, { cents: true })} />
          <Stat label="Leads (all time)" value={String(leads?.length ?? 0)} />
          <Stat label="Appointments" value={String(appointments?.length ?? 0)} />
          <Stat
            label="Estimated customer revenue"
            value={formatCurrency(estimatedRevenue)}
            hint="Across all tenants, estimated"
          />
          <Stat label="AI failures (7d)" value={String(failures?.length ?? 0)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Platform feature flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.entries(allFeatureFlags()).map(([flag, on]) => (
                <div key={flag} className="flex items-center justify-between">
                  <span className="text-slate-600">{flag}</span>
                  <Badge tone={on ? "success" : "danger"}>{on ? "enabled" : "disabled"}</Badge>
                </div>
              ))}
              <p className="pt-2 text-xs text-slate-500">
                Set the matching environment variable to <code>false</code> and redeploy
                to disable a capability platform-wide.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent failures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {failures?.length ? (
                failures.slice(0, 10).map((f, i) => (
                  <div key={i}>
                    <span className="font-medium">
                      {f.agent}/{f.action}
                    </span>
                    <p className="text-xs text-red-600">{f.error}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No failures in the last 7 days.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Businesses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Onboarded</th>
                  <th className="px-5 py-3 font-medium">AI</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(businesses ?? []).map((b) => {
                  const sub = (subscriptions ?? []).find((s) => s.business_id === b.id);
                  return (
                    <tr key={b.id}>
                      <td className="px-5 py-3 font-medium">{b.name}</td>
                      <td className="px-5 py-3">
                        {sub ? (
                          <Badge tone={statusTone(sub.status)}>
                            {sub.plan} · {sub.status}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">none</span>
                        )}
                      </td>
                      <td className="px-5 py-3">{b.onboarding_completed ? "yes" : "no"}</td>
                      <td className="px-5 py-3">{b.ai_enabled ? "on" : "off"}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {formatDateTime(b.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent audit events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(audits ?? []).map((a, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-700">{a.action}</span>
                <span className="text-xs text-slate-500">{formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
