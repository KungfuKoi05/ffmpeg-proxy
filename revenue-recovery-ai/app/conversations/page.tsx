import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("started_at", { ascending: false })
    .limit(100);

  const conversations = (data ?? []) as Conversation[];

  return (
    <DashboardShell businessName={ctx.business.name} active="/conversations">
      <h1 className="text-lg font-semibold tracking-tight">Conversations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Exactly what the assistant said, on every channel.
      </p>

      <Card className="mt-4">
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No conversations yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge tone="neutral">{c.channel}</Badge>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      {c.classification ? (
                        <Badge tone={statusTone(c.classification)}>{c.classification}</Badge>
                      ) : null}
                    </div>
                    {c.escalation_reason ? (
                      <p className="mt-1 text-xs text-amber-700">{c.escalation_reason}</p>
                    ) : null}
                    {c.summary ? (
                      <p className="mt-1 text-xs text-slate-600">{c.summary}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(c.started_at, ctx.business.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
