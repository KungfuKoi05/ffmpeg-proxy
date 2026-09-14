import { supabaseAdmin } from "./supabase/admin";
import type { AIUsage } from "./ai/types";

/**
 * Auditability (section 45). Every AI action is written here so an operator can
 * reconstruct exactly what the assistant did, why, and what it cost.
 *
 * Telemetry is best-effort and MUST NOT throw. These functions are called from
 * error handlers and from live customer calls; a logging failure that escaped
 * would replace the real error, or drop a call over a bookkeeping problem.
 * That includes client construction, which reads env and can throw.
 */
export async function logAiAction(input: {
  businessId: string;
  agent: string;
  action: string;
  leadId?: string | null;
  conversationId?: string | null;
  inputSummary?: string;
  outputSummary?: string;
  success?: boolean;
  error?: string;
  model?: string;
  usage?: AIUsage;
  latencyMs?: number;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("ai_actions").insert({
      business_id: input.businessId,
      lead_id: input.leadId ?? null,
      conversation_id: input.conversationId ?? null,
      agent: input.agent,
      action: input.action,
      input_summary: truncate(input.inputSummary),
      output_summary: truncate(input.outputSummary),
      success: input.success ?? true,
      error: input.error ?? null,
      model: input.model ?? null,
      input_tokens: input.usage?.inputTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
      estimated_cost: input.usage?.estimatedCostUsd ?? null,
      latency_ms: input.latencyMs ?? null,
    });
    if (error) console.error("[ai_actions] insert failed", error.message);
  } catch (err) {
    console.error("[ai_actions] unavailable", err instanceof Error ? err.message : err);
  }
}

export async function auditLog(input: {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("audit_logs").insert({
      business_id: input.businessId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[audit_logs] insert failed", error.message);
  } catch (err) {
    console.error("[audit_logs] unavailable", err instanceof Error ? err.message : err);
  }
}

function truncate(value?: string, max = 2000): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
