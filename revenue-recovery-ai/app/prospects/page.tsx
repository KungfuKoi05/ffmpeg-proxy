import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectImport } from "@/components/prospect-import";
import { isFeatureEnabled } from "@/lib/config/features";
import type { Prospect } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("prospects")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("lead_score", { ascending: false })
    .limit(200);

  const prospects = (data ?? []) as Prospect[];
  const enabled = isFeatureEnabled("PROSPECTING_ENABLED");

  return (
    <DashboardShell businessName={ctx.business.name} active="/prospects">
      <h1 className="text-lg font-semibold tracking-tight">Prospects</h1>
      <p className="mt-1 text-sm text-slate-500">
        Import a CSV, score it, and review drafted outreach before anything is sent.
      </p>

      {enabled ? (
        <div className="mt-4">
          <ProspectImport />
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Prospecting is disabled on this deployment.
        </p>
      )}

      <Card className="mt-4">
        <CardContent className="p-0">
          {prospects.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No prospects imported yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium">{p.company}</div>
                      {p.opportunity_reason ? (
                        <div className="mt-0.5 text-xs text-slate-500">{p.opportunity_reason}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {p.lead_score}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{p.contact_status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
