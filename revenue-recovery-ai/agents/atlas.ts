import { z } from "zod";
import { runAgent, type AgentDefinition } from "./base";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeMetrics } from "@/lib/revenue";

/**
 * ATLAS -- CEO / strategy agent.
 *
 * READ-ONLY BY CONSTRUCTION: it receives a pre-computed metrics snapshot and
 * returns analysis. It is given no tools that write, and callers must not pass
 * it a database handle (section 8, "Atlas must NOT directly modify production
 * data").
 */
export const AtlasInput = z.object({
  businessName: z.string(),
  periodDays: z.number().int().positive(),
  metrics: z.object({
    missedCalls: z.number(),
    leadsRecovered: z.number(),
    appointments: z.number(),
    estimatedRevenue: z.number(),
    actualRevenue: z.number(),
    conversionRate: z.number(),
    aiConversations: z.number(),
    humanEscalations: z.number(),
  }),
  topServices: z.array(z.object({ name: z.string(), count: z.number() })),
  lostReasons: z.array(z.string()),
});
export type AtlasInput = z.infer<typeof AtlasInput>;

export const AtlasOutput = z.object({
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  priority_actions: z.array(z.string()),
  revenue_opportunity: z.number(),
});
export type AtlasOutput = z.infer<typeof AtlasOutput>;

const stringArray = { type: "array", items: { type: "string" } };

export const atlas: AgentDefinition<AtlasInput, AtlasOutput> = {
  name: "atlas",
  description: "Business intelligence and strategy analysis. Read-only.",
  tier: "primary",
  inputSchema: AtlasInput,
  outputSchema: AtlasOutput,
  maxTokens: 4096,
  buildSystem: () =>
    `You are ATLAS, the strategy analyst for a company using an AI receptionist.

You receive a metrics snapshot and produce business intelligence. You are
READ-ONLY: you never instruct anyone to change production data directly.

Rules:
- Ground every claim in the numbers provided. Do not invent metrics.
- revenue_opportunity must be a defensible arithmetic estimate from the given
  numbers, not aspiration. Show your reasoning in recommendations.
- Distinguish an estimate from a measurement in your wording.
- Prioritise by revenue impact. At most 5 items per list.
- If the data is too sparse to conclude anything, say so plainly in
  recommendations rather than padding the lists.`,
  buildUserMessage: (input) =>
    `Business: ${input.businessName}
Period: last ${input.periodDays} days

Metrics:
${JSON.stringify(input.metrics, null, 2)}

Most requested services:
${input.topServices.map((s) => `- ${s.name}: ${s.count}`).join("\n") || "- none"}

Reasons leads were lost:
${input.lostReasons.map((r) => `- ${r}`).join("\n") || "- none recorded"}`,
  outputToolSchema: {
    type: "object",
    properties: {
      opportunities: stringArray,
      risks: stringArray,
      recommendations: stringArray,
      priority_actions: stringArray,
      revenue_opportunity: { type: "number" },
    },
    required: [
      "opportunities",
      "risks",
      "recommendations",
      "priority_actions",
      "revenue_opportunity",
    ],
  },
};

/** Gathers the snapshot Atlas analyses. Reads only. */
export async function buildAtlasInput(
  businessId: string,
  periodDays = 7,
): Promise<AtlasInput> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - periodDays * 86_400_000).toISOString();

  const [{ data: business }, { data: leads }, { data: calls }, { data: appts }, { data: convos }] =
    await Promise.all([
      db.from("businesses").select("name").eq("id", businessId).single(),
      db
        .from("leads")
        .select("status, estimated_value, actual_value, service_requested")
        .eq("business_id", businessId)
        .gte("created_at", since),
      db.from("calls").select("outcome").eq("business_id", businessId).gte("created_at", since),
      db.from("appointments").select("id").eq("business_id", businessId).gte("created_at", since),
      db
        .from("conversations")
        .select("status")
        .eq("business_id", businessId)
        .gte("started_at", since),
    ]);

  const leadRows = leads ?? [];
  const metrics = computeMetrics({
    leads: leadRows,
    missedCalls: (calls ?? []).filter((c) => c.outcome === "missed").length,
    appointments: (appts ?? []).length,
    aiConversations: (convos ?? []).length,
    humanEscalations: (convos ?? []).filter((c) => c.status === "escalated").length,
    responseSeconds: [],
  });

  const counts = new Map<string, number>();
  for (const lead of leadRows) {
    const key = lead.service_requested ?? "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    businessName: business?.name ?? "Unknown",
    periodDays,
    metrics: {
      missedCalls: metrics.missedCalls,
      leadsRecovered: metrics.leadsRecovered,
      appointments: metrics.appointments,
      estimatedRevenue: metrics.estimatedRevenue,
      actualRevenue: metrics.actualRevenue,
      conversionRate: Number(metrics.conversionRate.toFixed(4)),
      aiConversations: metrics.aiConversations,
      humanEscalations: metrics.humanEscalations,
    },
    topServices: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    lostReasons: leadRows.filter((l) => l.status === "lost").map(() => "lead marked lost"),
  };
}

export const runAtlas = (businessId: string, input: AtlasInput) =>
  runAgent(atlas, businessId, input);
