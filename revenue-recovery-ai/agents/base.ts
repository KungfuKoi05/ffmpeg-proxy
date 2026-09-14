import { z } from "zod";
import { ai } from "@/lib/ai";
import type { ModelTier } from "@/lib/config/models";
import { logAiAction } from "@/lib/logging";
import { recordAiUsage } from "@/lib/usage";
import { AppError } from "@/lib/errors";

/**
 * Shared agent runner (section 8).
 *
 * Every agent gets the same contract: validated input, a system prompt, a
 * schema-checked JSON output, usage accounting, and an ai_actions row whether
 * it succeeded or failed. Agents that skip this are not agents, they are labels.
 */
export interface AgentDefinition<TInput, TOutput> {
  name: string;
  description: string;
  tier: ModelTier;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  buildSystem: () => string;
  buildUserMessage: (input: TInput) => string;
  /** JSON Schema describing the tool the model must call to answer. */
  outputToolSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  maxTokens?: number;
}

export interface AgentRunResult<TOutput> {
  ok: boolean;
  output?: TOutput;
  error?: string;
}

export async function runAgent<TInput, TOutput>(
  def: AgentDefinition<TInput, TOutput>,
  businessId: string,
  rawInput: TInput,
): Promise<AgentRunResult<TOutput>> {
  const parsedInput = def.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return { ok: false, error: `invalid input: ${parsedInput.error.message}` };
  }

  const userMessage = def.buildUserMessage(parsedInput.data);

  try {
    const result = await ai().generate({
      tier: def.tier,
      system: def.buildSystem(),
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: "record_result",
          description: `Record the ${def.name} result.`,
          input_schema: def.outputToolSchema,
        },
      ],
      forceTool: "record_result",
      maxTokens: def.maxTokens ?? 4096,
    });

    await recordAiUsage(businessId, result.usage, { agent: def.name });

    if (result.stopReason === "refusal") {
      throw new AppError("AI_FAILURE", { reason: "model refused" });
    }

    const payload = result.toolCalls[0]?.input ?? {};
    const parsedOutput = def.outputSchema.safeParse(payload);

    if (!parsedOutput.success) {
      await logAiAction({
        businessId,
        agent: def.name,
        action: "run",
        inputSummary: userMessage,
        outputSummary: JSON.stringify(payload),
        success: false,
        error: `schema mismatch: ${parsedOutput.error.message}`,
        model: result.model,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });
      return { ok: false, error: "agent returned an unexpected shape" };
    }

    await logAiAction({
      businessId,
      agent: def.name,
      action: "run",
      inputSummary: userMessage,
      outputSummary: JSON.stringify(parsedOutput.data).slice(0, 1500),
      success: true,
      model: result.model,
      usage: result.usage,
      latencyMs: result.latencyMs,
    });

    return { ok: true, output: parsedOutput.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await logAiAction({
      businessId,
      agent: def.name,
      action: "run",
      inputSummary: userMessage,
      success: false,
      error: message,
    });
    return { ok: false, error: message };
  }
}
