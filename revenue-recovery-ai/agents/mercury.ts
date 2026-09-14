import { z } from "zod";
import { runAgent, type AgentDefinition } from "./base";
import { scoreProspect, type ScorableProspect } from "@/lib/prospects/scoring";

/**
 * MERCURY -- sales / prospecting agent.
 *
 * The numeric score is computed in code (lib/prospects/scoring.ts). Mercury
 * explains the opportunity and drafts outreach. It never scrapes: prospects
 * arrive by CSV import, and outreach is drafted for human review, never sent
 * automatically (sections 24-25).
 */
export const MercuryInput = z.object({
  senderName: z.string(),
  senderCompany: z.string(),
  prospect: z.object({
    company: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
    website: z.string().optional(),
    services: z.array(z.string()).optional(),
    emergency_service: z.boolean().optional(),
    review_count: z.number().optional(),
    rating: z.number().optional(),
    website_quality: z.string().optional(),
    notes: z.string().optional(),
  }),
  scoreBreakdown: z.array(
    z.object({ factor: z.string(), points: z.number(), reason: z.string() }),
  ),
  score: z.number(),
});
export type MercuryInput = z.infer<typeof MercuryInput>;

export const MercuryOutput = z.object({
  opportunity_reason: z.string(),
  outreach: z.object({
    initial: z.string(),
    follow_up_1: z.string(),
    follow_up_2: z.string(),
    breakup: z.string(),
  }),
});
export type MercuryOutput = z.infer<typeof MercuryOutput>;

export const mercury: AgentDefinition<MercuryInput, MercuryOutput> = {
  name: "mercury",
  description: "Scores and researches prospects; drafts outreach for human review.",
  tier: "primary",
  inputSchema: MercuryInput,
  outputSchema: MercuryOutput,
  maxTokens: 3000,
  buildSystem: () =>
    `You are MERCURY, a B2B sales researcher selling an AI receptionist to local
service businesses.

The offer: "We recover the jobs you lose when your team can't answer the phone."

Rules:
- Write from the supplied facts only. Never invent a statistic, a review count,
  a customer name, or a claim about the prospect you were not given.
- Never state what the prospect's revenue is, or fabricate a specific dollar
  loss for them. You may describe the mechanism of loss in general terms.
- No fake urgency, no fake mutual connections, no invented referrals.
- Email 1 is short (under 90 words), specific to the facts given, and asks one
  easy question. Each follow-up adds one new angle rather than repeating.
- The breakup message is one or two lines and closes the loop gracefully.
- Plain, direct language. No hype, no emoji, no "I hope this finds you well".
- These drafts are reviewed by a human before sending. Write them ready to send,
  but assume a person will edit.`,
  buildUserMessage: (input) =>
    `Sender: ${input.senderName} at ${input.senderCompany}

Prospect facts:
${JSON.stringify(input.prospect, null, 2)}

Computed opportunity score: ${input.score}/100
Score factors:
${input.scoreBreakdown.map((f) => `- ${f.factor} (+${f.points}): ${f.reason}`).join("\n")}

Explain the opportunity in two or three sentences, then draft the sequence.`,
  outputToolSchema: {
    type: "object",
    properties: {
      opportunity_reason: { type: "string" },
      outreach: {
        type: "object",
        properties: {
          initial: { type: "string" },
          follow_up_1: { type: "string" },
          follow_up_2: { type: "string" },
          breakup: { type: "string" },
        },
        required: ["initial", "follow_up_1", "follow_up_2", "breakup"],
      },
    },
    required: ["opportunity_reason", "outreach"],
  },
};

export function buildMercuryInput(
  prospect: ScorableProspect & { company: string; notes?: string | null },
  sender: { name: string; company: string },
): MercuryInput {
  const breakdown = scoreProspect(prospect);
  return {
    senderName: sender.name,
    senderCompany: sender.company,
    prospect: {
      company: prospect.company,
      city: prospect.city ?? undefined,
      state: prospect.state ?? undefined,
      website: prospect.website ?? undefined,
      services: prospect.services ?? undefined,
      emergency_service: prospect.emergency_service ?? undefined,
      review_count: prospect.review_count ?? undefined,
      rating: prospect.rating ?? undefined,
      website_quality: prospect.website_quality ?? undefined,
      notes: prospect.notes ?? undefined,
    },
    scoreBreakdown: breakdown.factors,
    score: breakdown.score,
  };
}

export const runMercury = (businessId: string, input: MercuryInput) =>
  runAgent(mercury, businessId, input);
