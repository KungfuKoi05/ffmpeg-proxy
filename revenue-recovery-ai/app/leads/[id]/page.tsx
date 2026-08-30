import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { LeadActions } from "@/components/lead-actions";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { AiAction, Appointment, Lead, Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();

  // RLS scopes this to the caller's tenant; a foreign id simply returns null.
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const [{ data: conversation }, { data: appointments }, { data: actions }] = await Promise.all([
    supabase.from("conversations").select("id").eq("lead_id", id).maybeSingle(),
    supabase.from("appointments").select("*").eq("lead_id", id).order("start_time"),
    supabase
      .from("ai_actions")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const { data: messages } = conversation
    ? await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at")
    : { data: [] };

  const typed = lead as Lead;

  return (
    <DashboardShell businessName={ctx.business.name} active="/leads">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {typed.name ?? typed.phone ?? "Unknown caller"}
          </h1>
          <p className="text-sm text-slate-500">
            {typed.service_requested ?? "Service not specified"} ·{" "}
            {formatDateTime(typed.created_at, ctx.business.timezone)}
          </p>
        </div>
        <Badge tone={statusTone(typed.status)}>{typed.status}</Badge>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(messages as Message[] | null)?.length ? (
                (messages as Message[]).map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.direction === "outbound"
                        ? "ml-8 rounded-lg bg-brand-50 px-3 py-2 text-sm"
                        : "mr-8 rounded-lg bg-slate-100 px-3 py-2 text-sm"
                    }
                  >
                    <div className="text-xs font-medium text-slate-500">
                      {m.sender} · {formatDateTime(m.created_at, ctx.business.timezone)}
                    </div>
                    {m.body}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No messages recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(actions as AiAction[] | null)?.length ? (
                <ul className="divide-y divide-slate-100">
                  {(actions as AiAction[]).map((a) => (
                    <li key={a.id} className="px-5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone={a.success ? "success" : "danger"}>{a.agent}</Badge>
                        <span className="font-medium">{a.action}</span>
                        <span className="ml-auto text-xs text-slate-400">
                          {formatDateTime(a.created_at, ctx.business.timezone)}
                        </span>
                      </div>
                      {a.output_summary ? (
                        <p className="mt-1 text-xs text-slate-600">{a.output_summary}</p>
                      ) : null}
                      {a.error ? <p className="mt-1 text-xs text-red-600">{a.error}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500">No AI actions logged.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Phone" value={typed.phone ?? "—"} />
              <Row label="Email" value={typed.email ?? "—"} />
              <Row label="Address" value={typed.address ?? "—"} />
              <Row label="Urgency" value={typed.urgency} />
              <Row label="Source" value={typed.source} />
              <Row label="Estimated" value={formatCurrency(Number(typed.estimated_value))} />
              <Row
                label="Actual"
                value={typed.actual_value === null ? "not recorded" : formatCurrency(Number(typed.actual_value))}
              />
              {typed.ai_summary ? (
                <p className="pt-2 text-xs leading-relaxed text-slate-600">{typed.ai_summary}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {(appointments as Appointment[] | null)?.length ? (
                <ul className="space-y-2 text-sm">
                  {(appointments as Appointment[]).map((a) => (
                    <li key={a.id} className="flex items-center justify-between">
                      <span>{formatDateTime(a.start_time, ctx.business.timezone)}</span>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">None booked.</p>
              )}
            </CardContent>
          </Card>

          <LeadActions leadId={typed.id} status={typed.status} actualValue={typed.actual_value} />
        </div>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
