import { ai } from "../ai";
import type { AIContentBlock, AIMessage } from "../ai/types";
import { supabaseAdmin } from "../supabase/admin";
import { AppError } from "../errors";
import { logAiAction } from "../logging";
import { assertWithinLimits, recordAiUsage, recordUsage } from "../usage";
import { isFeatureEnabled } from "../config/features";
import { buildSystemPrompt, type KnowledgeBase } from "./prompt";
import { RECEPTIONIST_TOOLS, executeTool, type ToolContext } from "./tools";
import type { Business, BusinessFaq, BusinessService, Channel } from "../types";

/** Bounds the tool loop so a confused model cannot spin up unbounded cost. */
const MAX_TOOL_ITERATIONS = 5;

export async function loadKnowledgeBase(businessId: string): Promise<KnowledgeBase> {
  const db = supabaseAdmin();
  const [{ data: business }, { data: services }, { data: faqs }] = await Promise.all([
    db.from("businesses").select("*").eq("id", businessId).single(),
    db.from("business_services").select("*").eq("business_id", businessId).eq("active", true),
    db.from("business_faqs").select("*").eq("business_id", businessId).eq("active", true),
  ]);

  if (!business) throw new AppError("NOT_FOUND", { businessId });

  return {
    business: business as Business,
    services: (services ?? []) as BusinessService[],
    faqs: (faqs ?? []) as BusinessFaq[],
  };
}

/**
 * Maps an inbound Twilio number to a tenant. This is the ONLY place tenancy is
 * decided for webhooks -- never from request parameters (section 22).
 */
export async function resolveBusinessByPhone(toNumber: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("phone_numbers")
    .select("business_id")
    .eq("phone_number", toNumber)
    .eq("status", "active")
    .maybeSingle();
  return data?.business_id ?? null;
}

export async function getOrCreateConversation(input: {
  businessId: string;
  channel: Channel;
  externalId: string;
}): Promise<{ id: string; leadId: string | null }> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("conversations")
    .select("id, lead_id")
    .eq("business_id", input.businessId)
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (existing) return { id: existing.id, leadId: existing.lead_id };

  const { data, error } = await db
    .from("conversations")
    .insert({
      business_id: input.businessId,
      channel: input.channel,
      external_id: input.externalId,
      status: "active",
    })
    .select("id, lead_id")
    .single();

  if (error || !data) throw new AppError("INTERNAL", { step: "create_conversation" }, error);
  return { id: data.id, leadId: data.lead_id };
}

async function loadHistory(conversationId: string): Promise<AIMessage[]> {
  const { data } = await supabaseAdmin()
    .from("messages")
    .select("direction, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  return (data ?? []).map((m) => ({
    role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    content: m.body,
  }));
}

export interface TurnResult {
  reply: string;
  escalated: boolean;
  escalationReason?: string;
  appointmentCreated: boolean;
  leadId: string | null;
  toolsUsed: string[];
}

/**
 * Runs one turn of the receptionist conversation.
 *
 * Sequence: persist the caller's message -> loop (model -> tools -> model)
 * until the model stops calling tools -> persist the reply. Every tool result
 * is fed back verbatim, so a FAILED result is visible to the model and it
 * cannot claim success.
 */
export async function runReceptionistTurn(input: {
  businessId: string;
  conversationId: string;
  channel: Channel;
  userText: string;
  callerPhone: string | null;
  leadId: string | null;
}): Promise<TurnResult> {
  const db = supabaseAdmin();
  const kb = await loadKnowledgeBase(input.businessId);

  if (!isFeatureEnabled("AI_ENABLED") || !kb.business.ai_enabled) {
    throw new AppError("FEATURE_DISABLED", { feature: "ai" });
  }
  await assertWithinLimits(input.businessId, "ai_conversation");

  await db.from("messages").insert({
    conversation_id: input.conversationId,
    business_id: input.businessId,
    direction: "inbound",
    sender: "caller",
    body: input.userText,
  });

  const history = await loadHistory(input.conversationId);
  const messages: AIMessage[] = history.length
    ? history
    : [{ role: "user", content: input.userText }];

  const ctx: ToolContext = {
    businessId: input.businessId,
    conversationId: input.conversationId,
    kb,
    callerPhone: input.callerPhone,
    leadId: input.leadId,
    escalation: null,
    appointmentCreated: false,
    channel: input.channel === "voice" ? "voice" : input.channel === "sms" ? "sms" : "web",
  };

  const system = buildSystemPrompt(kb, ctx.channel);
  const toolsUsed: string[] = [];
  let reply = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const result = await ai().generate({
      tier: "primary",
      system,
      messages,
      tools: RECEPTIONIST_TOOLS,
      maxTokens: 1024,
    });

    await recordAiUsage(input.businessId, result.usage, {
      agent: "receptionist",
      conversation_id: input.conversationId,
    });

    // A safety refusal is never retried -- it goes straight to a human.
    if (result.stopReason === "refusal") {
      ctx.escalation = { reason: "Model declined to answer (safety refusal)." };
      await executeTool("escalate_to_human", { reason: ctx.escalation.reason }, ctx);
      reply =
        "Let me get a team member to help you with that. Someone will follow up shortly.";
      break;
    }

    if (result.text) reply = result.text;

    if (!result.toolCalls.length) {
      await logAiAction({
        businessId: input.businessId,
        conversationId: input.conversationId,
        leadId: ctx.leadId,
        agent: "receptionist",
        action: "reply",
        inputSummary: input.userText,
        outputSummary: reply,
        model: result.model,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });
      break;
    }

    const assistantBlocks: AIContentBlock[] = [];
    if (result.text) assistantBlocks.push({ type: "text", text: result.text });
    for (const call of result.toolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: call.input,
      });
    }
    messages.push({ role: "assistant", content: assistantBlocks });

    const resultBlocks: AIContentBlock[] = [];
    for (const call of result.toolCalls) {
      toolsUsed.push(call.name);
      let output: string;
      try {
        output = await executeTool(call.name, call.input, ctx);
      } catch (err) {
        output = `FAILED: ${err instanceof Error ? err.message : "tool error"}`;
      }

      await logAiAction({
        businessId: input.businessId,
        conversationId: input.conversationId,
        leadId: ctx.leadId,
        agent: "receptionist",
        action: call.name,
        inputSummary: JSON.stringify(call.input),
        outputSummary: output,
        success: !output.startsWith("FAILED"),
        error: output.startsWith("FAILED") ? output : undefined,
        model: result.model,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });

      resultBlocks.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: output,
        is_error: output.startsWith("FAILED"),
      });
    }
    // All tool results go back in ONE user message -- splitting them trains the
    // model out of parallel tool calls.
    messages.push({ role: "user", content: resultBlocks });
  }

  if (!reply) {
    reply = "I want to make sure we get this right -- let me have someone call you back.";
    if (!ctx.escalation) {
      await executeTool("escalate_to_human", { reason: "No reply produced." }, ctx);
    }
  }

  await db.from("messages").insert({
    conversation_id: input.conversationId,
    business_id: input.businessId,
    direction: "outbound",
    sender: "ai",
    body: reply,
  });

  await recordUsage({
    businessId: input.businessId,
    eventType: "ai_conversation",
    quantity: 1,
    estimatedCost: 0,
    metadata: { channel: ctx.channel },
  });

  return {
    reply,
    escalated: Boolean(ctx.escalation),
    escalationReason: ctx.escalation?.reason,
    appointmentCreated: ctx.appointmentCreated,
    leadId: ctx.leadId,
    toolsUsed,
  };
}
