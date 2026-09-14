import Link from "next/link";
import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "new", "contacted", "qualified", "booked", "completed", "lost", "spam"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireBusiness();
  const params = await searchParams;
  const supabase = await supabaseServer();

  let query = supabase
    .from("leads")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.status && params.status !== "all") query = query.eq("status", params.status);
  if (params.q) query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);

  const { data } = await query;
  const leads = (data ?? []) as Lead[];

  return (
    <DashboardShell businessName={ctx.business.name} active="/leads">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <span className="text-xs text-slate-500">{leads.length} shown</span>
      </div>

      <form className="mt-4 flex flex-wrap gap-2" action="/leads">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search name or phone"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      <Card className="mt-4">
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No leads match. They appear here automatically as calls come in.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Urgency</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Estimated</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-brand-600">
                        {lead.name ?? lead.phone ?? "Unknown"}
                      </Link>
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{lead.service_requested ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-700">{lead.urgency}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(lead.status)}>{lead.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(Number(lead.estimated_value))}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatDateTime(lead.created_at, ctx.business.timezone)}
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
