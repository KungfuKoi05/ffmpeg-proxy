import { z } from "zod";
import { runAgent, type AgentDefinition } from "./base";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/env";

/**
 * FORGE -- CTO / automation agent.
 *
 * Diagnoses only. It has no write tools and no deploy capability by design
 * (section 8: "Forge must NOT automatically deploy destructive changes"). Its
 * output is a diagnosis a human acts on.
 */
export const ForgeInput = z.object({
  integrations: z.record(z.string(), z.boolean()),
  recentErrors: z.array(
    z.object({ agent: z.string(), action: z.string(), error: z.string(), count: z.number() }),
  ),
  failedWebhooks: z.number(),
  aiFailureRate: z.number(),
  usageAnomalies: z.array(z.string()),
  totalAiCostUsd: z.number(),
});
export type ForgeInput = z.infer<typeof ForgeInput>;

export const ForgeOutput = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  findings: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high", "critical"]),
      area: z.string(),
      finding: z.string(),
      recommended_fix: z.string(),
    }),
  ),
  summary: z.string(),
});
export type ForgeOutput = z.infer<typeof ForgeOutput>;

export const forge: AgentDefinition<ForgeInput, ForgeOutput> = {
  name: "forge",
  description: "System health diagnostics. Recommends fixes; applies none.",
  tier: "fast",
  inputSchema: ForgeInput,
  outputSchema: ForgeOutput,
  maxTokens: 2500,
  buildSystem: () =>
    `You are FORGE, the reliability diagnostician for a multi-tenant SaaS running
an AI receptionist over Twilio, Stripe, Supabase and the Anthropic API.

You produce diagnoses. You never apply changes and never recommend a
destructive one-liner. Recommended fixes should be specific and safe to review.

Severity guide:
- critical: customers are losing calls or leads right now.
- high: a core integration is failing or costs are running away.
- medium: elevated errors, degraded but functioning.
- low: hygiene.

If the data shows nothing wrong, return status "healthy" with an empty findings
list. Do not manufacture findings to look useful.`,
  buildUserMessage: (input) =>
    `Integrations configured: ${JSON.stringify(input.integrations)}
Failed webhook events (24h): ${input.failedWebhooks}
AI failure rate (24h): ${(input.aiFailureRate * 100).toFixed(1)}%
AI spend (current period): $${input.totalAiCostUsd.toFixed(2)}

Recent errors:
${input.recentErrors.map((e) => `- ${e.agent}/${e.action} x${e.count}: ${e.error}`).join("\n") || "- none"}

Usage anomalies:
${input.usageAnomalies.map((a) => `- ${a}`).join("\n") || "- none"}`,
  outputToolSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            area: { type: "string" },
            finding: { type: "string" },
            recommended_fix: { type: "string" },
          },
          required: ["severity", "area", "finding", "recommended_fix"],
        },
      },
      summary: { type: "string" },
    },
    required: ["status", "findings", "summary"],
  },
};

/** Collects diagnostics for one tenant. Read-only. */
export async function buildForgeInput(businessId: string): Promise<ForgeInput> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const [{ data: actions }, { data: audits }, { data: usage }] = await Promise.all([
    db
      .from("ai_actions")
      .select("agent, action, success, error")
      .eq("business_id", businessId)
      .gte("created_at", since),
    db
      .from("audit_logs")
      .select("action")
      .eq("business_id", businessId)
      .gte("created_at", since),
    db
      .from("usage_events")
      .select("event_type, quantity, estimated_cost")
      .eq("business_id", businessId)
      .gte("created_at", since),
  ]);

  const rows = actions ?? [];
  const failures = rows.filter((r) => !r.success);
  const grouped = new Map<string, { agent: string; action: string; error: string; count: number }>();
  for (const row of failures) {
    const key = `${row.agent}|${row.action}|${row.error ?? ""}`;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else
      grouped.set(key, {
        agent: row.agent,
        action: row.action,
        error: (row.error ?? "unknown").slice(0, 300),
        count: 1,
      });
  }

  const anomalies: string[] = [];
  const smsCount = (usage ?? [])
    .filter((u) => u.event_type === "sms_segment")
    .reduce((s, u) => s + Number(u.quantity), 0);
  if (smsCount > 500) anomalies.push(`${smsCount} SMS segments in 24h -- unusually high`);
  const aiCost = (usage ?? []).reduce((s, u) => s + Number(u.estimated_cost ?? 0), 0);
  if (aiCost > 25) anomalies.push(`$${aiCost.toFixed(2)} AI spend in 24h`);

  return {
    integrations: integrationStatus() as unknown as Record<string, boolean>,
    recentErrors: [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    failedWebhooks: (audits ?? []).filter((a) => a.action.includes("failed")).length,
    aiFailureRate: rows.length ? failures.length / rows.length : 0,
    usageAnomalies: anomalies,
    totalAiCostUsd: aiCost,
  };
}

export const runForge = (businessId: string, input: ForgeInput) =>
  runAgent(forge, businessId, input);
