import { supabaseServer } from "../supabase/server";
import { computeMetrics, type RecoveryMetrics } from "../revenue";
import type { Appointment, Call, Conversation, Lead } from "../types";

/**
 * Dashboard reads go through the request-scoped client so RLS applies. A bug
 * here cannot leak another tenant's rows -- the database refuses them.
 */
export interface OverviewData {
  metrics: RecoveryMetrics;
  recentLeads: Lead[];
  series: { date: string; leads: number; appointments: number; revenue: number }[];
  callOutcomes: { outcome: string; count: number }[];
}

export async function getOverview(
  businessId: string,
  days = 30,
): Promise<OverviewData> {
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [leadsRes, callsRes, apptsRes, convosRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase
      .from("calls")
      .select("outcome, created_at")
      .eq("business_id", businessId)
      .gte("created_at", since),
    supabase
      .from("appointments")
      .select("id, created_at, lead_id")
      .eq("business_id", businessId)
      .gte("created_at", since),
    supabase
      .from("conversations")
      .select("status, started_at")
      .eq("business_id", businessId)
      .gte("started_at", since),
  ]);

  const leads = (leadsRes.data ?? []) as Lead[];
  const calls = (callsRes.data ?? []) as Pick<Call, "outcome" | "created_at">[];
  const appointments = (apptsRes.data ?? []) as Pick<Appointment, "id" | "created_at">[];
  const conversations = (convosRes.data ?? []) as Pick<Conversation, "status" | "started_at">[];

  const metrics = computeMetrics({
    leads,
    missedCalls: calls.filter((c) => c.outcome === "missed").length,
    appointments: appointments.length,
    aiConversations: conversations.length,
    humanEscalations: conversations.filter((c) => c.status === "escalated").length,
    responseSeconds: [],
  });

  // Daily buckets for the charts.
  const buckets = new Map<string, { leads: number; appointments: number; revenue: number }>();
  const dayKey = (iso: string) => iso.slice(0, 10);
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(Date.now() - i * 86_400_000).toISOString()), {
      leads: 0,
      appointments: 0,
      revenue: 0,
    });
  }
  for (const lead of leads) {
    const bucket = buckets.get(dayKey(lead.created_at));
    if (!bucket) continue;
    bucket.leads += 1;
    if (lead.status === "booked" || lead.status === "completed") {
      bucket.revenue += Number(lead.estimated_value) || 0;
    }
  }
  for (const appt of appointments) {
    const bucket = buckets.get(dayKey(appt.created_at));
    if (bucket) bucket.appointments += 1;
  }

  const outcomes = new Map<string, number>();
  for (const call of calls) {
    const key = call.outcome ?? "unknown";
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  }

  return {
    metrics,
    recentLeads: leads.slice(0, 8),
    series: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
    callOutcomes: [...outcomes.entries()].map(([outcome, count]) => ({ outcome, count })),
  };
}
