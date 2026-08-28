import { supabaseAdmin } from "./supabase/admin";
import { AppError } from "./errors";
import { PLANS, isPlanId } from "./config/plans";
import type { AIUsage } from "./ai/types";
import type { PlanId } from "./types";

/**
 * Usage metering and plan enforcement (section 40).
 *
 * The rule: never let a customer silently generate unbounded cost. Every
 * billable action records a usage_event, and the limit check runs BEFORE the
 * expensive call, not after.
 */
export type UsageEventType =
  | "ai_conversation"
  | "ai_tokens"
  | "sms_segment"
  | "voice_minute";

export async function recordUsage(input: {
  businessId: string;
  eventType: UsageEventType;
  quantity: number;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("usage_events").insert({
    business_id: input.businessId,
    event_type: input.eventType,
    quantity: input.quantity,
    estimated_cost: input.estimatedCost,
    metadata: input.metadata ?? {},
  });
  // Metering must never take down the customer-facing path; log and continue.
  if (error) console.error("[usage] insert failed", error.message);
}

export async function recordAiUsage(
  businessId: string,
  usage: AIUsage,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await recordUsage({
    businessId,
    eventType: "ai_tokens",
    quantity: usage.inputTokens + usage.outputTokens,
    estimatedCost: usage.estimatedCostUsd,
    metadata: {
      ...metadata,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    },
  });
}

function periodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface UsageSummary {
  plan: PlanId;
  aiConversations: { used: number; limit: number };
  smsSegments: { used: number; limit: number };
  voiceMinutes: { used: number; limit: number };
  estimatedCostUsd: number;
}

export async function getUsageSummary(businessId: string): Promise<UsageSummary> {
  const db = supabaseAdmin();

  const [{ data: sub }, { data: events }] = await Promise.all([
    db.from("subscriptions").select("plan").eq("business_id", businessId).maybeSingle(),
    db
      .from("usage_events")
      .select("event_type, quantity, estimated_cost")
      .eq("business_id", businessId)
      .gte("created_at", periodStart()),
  ]);

  const plan: PlanId = sub?.plan && isPlanId(sub.plan) ? sub.plan : "starter";
  const limits = PLANS[plan].limits;

  const total = (type: UsageEventType) =>
    (events ?? [])
      .filter((e) => e.event_type === type)
      .reduce((sum, e) => sum + Number(e.quantity ?? 0), 0);

  return {
    plan,
    aiConversations: { used: total("ai_conversation"), limit: limits.aiConversations },
    smsSegments: { used: total("sms_segment"), limit: limits.smsSegments },
    voiceMinutes: { used: total("voice_minute"), limit: limits.voiceMinutes },
    estimatedCostUsd: (events ?? []).reduce(
      (sum, e) => sum + Number(e.estimated_cost ?? 0),
      0,
    ),
  };
}

/** Throws USAGE_LIMIT_REACHED before an over-limit action runs. */
export async function assertWithinLimits(
  businessId: string,
  kind: "ai_conversation" | "sms_segment" | "voice_minute",
): Promise<void> {
  const summary = await getUsageSummary(businessId);
  const bucket =
    kind === "ai_conversation"
      ? summary.aiConversations
      : kind === "sms_segment"
        ? summary.smsSegments
        : summary.voiceMinutes;

  if (bucket.used >= bucket.limit) {
    throw new AppError("USAGE_LIMIT_REACHED", {
      kind,
      used: bucket.used,
      limit: bucket.limit,
      plan: summary.plan,
    });
  }
}
