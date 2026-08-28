import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Call } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("calls")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const calls = (data ?? []) as Call[];

  return (
    <DashboardShell businessName={ctx.business.name} active="/calls">
      <h1 className="text-lg font-semibold tracking-tight">Calls</h1>
      <Card className="mt-4">
        <CardContent className="p-0">
          {calls.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No calls recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">From</th>
                  <th className="px-5 py-3 font-medium">Outcome</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3">{c.from_number ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={c.outcome === "missed" ? "warning" : "neutral"}>
                        {c.outcome ?? "unknown"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{c.duration ? `${c.duration}s` : "—"}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDateTime(c.created_at, ctx.business.timezone)}
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
