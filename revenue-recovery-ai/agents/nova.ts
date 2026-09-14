import { z } from "zod";
import { runAgent, type AgentDefinition } from "./base";

/**
 * NOVA -- marketing / conversion copy.
 *
 * Deliberately narrow: it supports sales with structured copy on request. It is
 * NOT a content pipeline and is never scheduled (section 8: "Do not build an
 * expensive automated content-generation system").
 */
export const NovaInput = z.object({
  assetType: z.enum([
    "landing_hero",
    "cold_email",
    "sms_outreach",
    "case_study",
    "sales_script",
    "onboarding_copy",
    "follow_up",
  ]),
  audience: z.string(),
  context: z.string(),
  proofPoints: z.array(z.string()),
});
export type NovaInput = z.infer<typeof NovaInput>;

export const NovaOutput = z.object({
  headline: z.string(),
  subheadline: z.string(),
  body: z.string(),
  call_to_action: z.string(),
  variants: z.array(z.string()),
});
export type NovaOutput = z.infer<typeof NovaOutput>;

export const nova: AgentDefinition<NovaInput, NovaOutput> = {
  name: "nova",
  description: "Generates structured marketing and sales copy.",
  tier: "primary",
  inputSchema: NovaInput,
  outputSchema: NovaOutput,
  maxTokens: 2500,
  buildSystem: () =>
    `You are NOVA, a direct-response copywriter for a B2B product that answers
missed calls for local service businesses and turns them into booked jobs.

Rules:
- Use ONLY the proof points supplied. If none are supplied, write without
  statistics. Never invent a customer, a testimonial, a percentage, or a result.
- Never promise a specific revenue outcome. Frame it as recovering opportunity
  that is currently lost.
- Speak like an operator talking to a business owner: concrete, unhyped, short
  sentences. No "unlock", "revolutionise", "game-changing", no emoji.
- The reader is busy and sceptical. Lead with the problem they already feel.
- variants: two or three alternative headlines, nothing else.`,
  buildUserMessage: (input) =>
    `Asset: ${input.assetType}
Audience: ${input.audience}
Context: ${input.context}
Proof points available:
${input.proofPoints.map((p) => `- ${p}`).join("\n") || "- none (write without statistics)"}`,
  outputToolSchema: {
    type: "object",
    properties: {
      headline: { type: "string" },
      subheadline: { type: "string" },
      body: { type: "string" },
      call_to_action: { type: "string" },
      variants: { type: "array", items: { type: "string" } },
    },
    required: ["headline", "subheadline", "body", "call_to_action", "variants"],
  },
};

export const runNova = (businessId: string, input: NovaInput) =>
  runAgent(nova, businessId, input);
