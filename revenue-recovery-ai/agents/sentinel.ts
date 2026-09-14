import { z } from "zod";
import { runAgent, type AgentDefinition } from "./base";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * SENTINEL -- QA / safety agent.
 *
 * Reviews what the receptionist actually said and classifies the conversation.
 * Biased toward escalation: when uncertain it must return NEEDS_HUMAN, because
 * a false escalation costs a phone call and a missed one costs a customer.
 */
export const SentinelInput = z.object({
  businessName: z.string(),
  knownServices: z.array(z.string()),
  transcript: z.array(z.object({ speaker: z.string(), text: z.string() })),
  leadComplete: z.boolean(),
  appointmentCreated: z.boolean(),
});
export type SentinelInput = z.infer<typeof SentinelInput>;

export const SentinelOutput = z.object({
  classification: z.enum(["SAFE", "NEEDS_HUMAN", "HIGH_VALUE", "RISK", "SPAM"]),
  reason: z.string(),
  hallucination_detected: z.boolean(),
  hallucination_detail: z.string().optional(),
  missing_information: z.array(z.string()),
  recommended_action: z.string(),
});
export type SentinelOutput = z.infer<typeof SentinelOutput>;

export const sentinel: AgentDefinition<SentinelInput, SentinelOutput> = {
  name: "sentinel",
  description: "Validates receptionist conversations and flags risk.",
  tier: "fast",
  inputSchema: SentinelInput,
  outputSchema: SentinelOutput,
  maxTokens: 1500,
  buildSystem: () =>
    `You are SENTINEL, the quality and safety reviewer for an AI receptionist.

Read the transcript and classify it. Classifications:
- SAFE: handled correctly, nothing asserted beyond the knowledge base.
- NEEDS_HUMAN: uncertainty, an unanswered question, a promise that needs a
  person, or missing lead details on a real inquiry.
- HIGH_VALUE: a large job (replacement, install, commercial) worth immediate
  human follow-up.
- RISK: the assistant may have said something wrong or harmful -- invented
  pricing, invented availability, a safety-relevant instruction, a guarantee, or
  a claim about a technician.
- SPAM: not a genuine service inquiry.

hallucination_detected must be true if the assistant stated ANY specific price,
availability, policy, warranty, or technician commitment. Quote the offending
line in hallucination_detail.

When you are uncertain between two classifications, choose the one that gets a
human involved. Under-escalating is the expensive mistake.`,
  buildUserMessage: (input) =>
    `Business: ${input.businessName}
Configured services: ${input.knownServices.join(", ") || "none"}
Lead details complete: ${input.leadComplete}
Appointment created: ${input.appointmentCreated}

Transcript:
${input.transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n")}`,
  outputToolSchema: {
    type: "object",
    properties: {
      classification: {
        type: "string",
        enum: ["SAFE", "NEEDS_HUMAN", "HIGH_VALUE", "RISK", "SPAM"],
      },
      reason: { type: "string" },
      hallucination_detected: { type: "boolean" },
      hallucination_detail: { type: "string" },
      missing_information: { type: "array", items: { type: "string" } },
      recommended_action: { type: "string" },
    },
    required: [
      "classification",
      "reason",
      "hallucination_detected",
      "missing_information",
      "recommended_action",
    ],
  },
};

/** Reviews one conversation and persists the classification. */
export async function reviewConversation(
  businessId: string,
  conversationId: string,
): Promise<SentinelOutput | null> {
  const db = supabaseAdmin();

  const [{ data: business }, { data: services }, { data: messages }, { data: conversation }] =
    await Promise.all([
      db.from("businesses").select("name").eq("id", businessId).single(),
      db.from("business_services").select("name").eq("business_id", businessId),
      db
        .from("messages")
        .select("direction, body")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
      db
        .from("conversations")
        .select("lead_id")
        .eq("id", conversationId)
        .maybeSingle(),
    ]);

  if (!messages?.length) return null;

  let leadComplete = false;
  let appointmentCreated = false;
  if (conversation?.lead_id) {
    const [{ data: lead }, { data: appts }] = await Promise.all([
      db
        .from("leads")
        .select("name, phone, service_requested")
        .eq("id", conversation.lead_id)
        .maybeSingle(),
      db.from("appointments").select("id").eq("lead_id", conversation.lead_id).limit(1),
    ]);
    leadComplete = Boolean(lead?.name && lead?.phone && lead?.service_requested);
    appointmentCreated = Boolean(appts?.length);
  }

  const result = await runAgent(sentinel, businessId, {
    businessName: business?.name ?? "Unknown",
    knownServices: (services ?? []).map((s) => s.name),
    transcript: messages.map((m) => ({
      speaker: m.direction === "inbound" ? "Customer" : "AI",
      text: m.body,
    })),
    leadComplete,
    appointmentCreated,
  });

  if (!result.ok || !result.output) return null;

  await db
    .from("conversations")
    .update({
      classification: result.output.classification,
      escalation_reason:
        result.output.classification === "SAFE" ? null : result.output.reason,
      ...(result.output.classification === "NEEDS_HUMAN" ||
      result.output.classification === "RISK"
        ? { status: "escalated" as const }
        : {}),
    })
    .eq("id", conversationId);

  return result.output;
}

export const runSentinel = (businessId: string, input: SentinelInput) =>
  runAgent(sentinel, businessId, input);
