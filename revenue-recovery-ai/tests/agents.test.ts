import { describe, expect, it, beforeEach, vi } from "vitest";
import { __setProvider } from "@/lib/ai";
import { MockProvider } from "@/lib/ai/mock";
import { runAgent } from "@/agents/base";
import { atlas, AtlasOutput, type AtlasInput } from "@/agents/atlas";
import { mercury, MercuryOutput, buildMercuryInput } from "@/agents/mercury";
import { forge, ForgeOutput, type ForgeInput } from "@/agents/forge";
import { nova, NovaOutput, type NovaInput } from "@/agents/nova";
import { sentinel, SentinelOutput, type SentinelInput } from "@/agents/sentinel";

/**
 * Spec section 8 requires tests per agent. These run every agent end to end
 * through the shared runner with the mock provider and assert the output
 * satisfies the agent's own Zod contract.
 *
 * Note there is no Supabase configured here on purpose: it doubles as the
 * regression test that telemetry failures never escape runAgent.
 */
const BUSINESS = "00000000-0000-0000-0000-000000000001";

const atlasInput: AtlasInput = {
  businessName: "Acme Heating & Air",
  periodDays: 7,
  metrics: {
    missedCalls: 47, leadsRecovered: 31, appointments: 18,
    estimatedRevenue: 12450, actualRevenue: 3200,
    conversionRate: 0.38, aiConversations: 54, humanEscalations: 6,
  },
  topServices: [{ name: "AC Repair", count: 14 }],
  lostReasons: ["lead marked lost"],
};

const forgeInput: ForgeInput = {
  integrations: { supabase: true, ai: true, twilio: true, stripe: false },
  recentErrors: [{ agent: "receptionist", action: "send_sms", error: "timeout", count: 3 }],
  failedWebhooks: 1,
  aiFailureRate: 0.04,
  usageAnomalies: [],
  totalAiCostUsd: 12.5,
};

const novaInput: NovaInput = {
  assetType: "cold_email",
  audience: "HVAC owners in Austin",
  context: "They miss calls during the summer rush.",
  proofPoints: [],
};

const sentinelInput: SentinelInput = {
  businessName: "Acme Heating & Air",
  knownServices: ["AC Repair"],
  transcript: [
    { speaker: "Customer", text: "My AC isn't cooling." },
    { speaker: "AI", text: "Is it running but blowing warm?" },
  ],
  leadComplete: false,
  appointmentCreated: false,
};

describe("agents", () => {
  beforeEach(() => __setProvider(new MockProvider()));

  it("atlas returns the documented contract", async () => {
    const result = await runAgent(atlas, BUSINESS, atlasInput);
    expect(result.ok).toBe(true);
    const parsed = AtlasOutput.safeParse(result.output);
    expect(parsed.success).toBe(true);
    // The exact five keys from the spec, nothing missing.
    expect(Object.keys(result.output!).sort()).toEqual([
      "opportunities", "priority_actions", "recommendations", "revenue_opportunity", "risks",
    ]);
    expect(typeof result.output!.revenue_opportunity).toBe("number");
  });

  it("mercury returns an opportunity and a four-step sequence", async () => {
    const input = buildMercuryInput(
      { company: "Lone Star Air", review_count: 140, emergency_service: true, city: "Austin", state: "TX" },
      { name: "Sam", company: "Revenue Recovery AI" },
    );
    const result = await runAgent(mercury, BUSINESS, input);
    expect(result.ok).toBe(true);
    expect(MercuryOutput.safeParse(result.output).success).toBe(true);
    expect(Object.keys(result.output!.outreach).sort()).toEqual([
      "breakup", "follow_up_1", "follow_up_2", "initial",
    ]);
  });

  it("mercury's score comes from code, not the model", () => {
    const input = buildMercuryInput(
      { company: "X", review_count: 140, emergency_service: true, city: "Austin", state: "TX" },
      { name: "Sam", company: "RRA" },
    );
    // Deterministic, and every point is explained.
    expect(input.score).toBeGreaterThan(0);
    expect(input.score).toBe(input.scoreBreakdown.reduce((s, f) => s + f.points, 0));
  });

  it("forge returns a status and findings", async () => {
    const result = await runAgent(forge, BUSINESS, forgeInput);
    expect(result.ok).toBe(true);
    expect(ForgeOutput.safeParse(result.output).success).toBe(true);
    expect(["healthy", "degraded", "unhealthy"]).toContain(result.output!.status);
  });

  it("nova returns structured copy", async () => {
    const result = await runAgent(nova, BUSINESS, novaInput);
    expect(result.ok).toBe(true);
    expect(NovaOutput.safeParse(result.output).success).toBe(true);
  });

  it("sentinel returns a valid classification", async () => {
    const result = await runAgent(sentinel, BUSINESS, sentinelInput);
    expect(result.ok).toBe(true);
    expect(SentinelOutput.safeParse(result.output).success).toBe(true);
    expect(["SAFE", "NEEDS_HUMAN", "HIGH_VALUE", "RISK", "SPAM"]).toContain(
      result.output!.classification,
    );
    expect(typeof result.output!.hallucination_detected).toBe("boolean");
  });

  it("rejects invalid input without calling the model", async () => {
    const provider = new MockProvider();
    const spy = vi.spyOn(provider, "generate");
    __setProvider(provider);

    const result = await runAgent(atlas, BUSINESS, { businessName: "x" } as never);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid input/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns a result instead of throwing when telemetry is unavailable", async () => {
    // No Supabase is configured in this suite. Previously the error logger in
    // runAgent's catch block threw on client construction and escaped the
    // function, replacing the real error with CONFIG_MISSING.
    const provider = new MockProvider();
    vi.spyOn(provider, "generate").mockRejectedValue(new Error("upstream exploded"));
    __setProvider(provider);

    const result = await runAgent(atlas, BUSINESS, atlasInput);
    expect(result.ok).toBe(false);
    // The real cause survives rather than being masked by a logging failure.
    expect(result.error).toBe("upstream exploded");
  });

  it("rejects a model response that does not match the output schema", async () => {
    const provider = new MockProvider();
    vi.spyOn(provider, "generate").mockResolvedValue({
      text: "",
      toolCalls: [{ id: "x", name: "record_result", input: { nonsense: true } }],
      stopReason: "tool_use",
      model: "claude-opus-5",
      usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
      latencyMs: 1,
    });
    __setProvider(provider);

    const result = await runAgent(atlas, BUSINESS, atlasInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unexpected shape/);
  });

  it("escalates rather than returning output when the model refuses", async () => {
    const provider = new MockProvider();
    vi.spyOn(provider, "generate").mockResolvedValue({
      text: "",
      toolCalls: [],
      stopReason: "refusal",
      model: "claude-opus-5",
      usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
      latencyMs: 1,
    });
    __setProvider(provider);

    const result = await runAgent(atlas, BUSINESS, atlasInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/refused/);
  });
});
