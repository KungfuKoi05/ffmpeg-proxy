import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { AppError, withRetry } from "../errors";
import { effortFor, estimateCostUsd, modelFor } from "../config/models";
import type {
  AIProvider,
  AIToolCall,
  AIToolDefinition,
  GenerateRequest,
  GenerateResult,
} from "./types";

const DEFAULT_MAX_TOKENS = 4096;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey() });
  return client;
}

/** 429 and 5xx are worth another attempt; 400/401/404 never are. */
function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) return (err.status ?? 0) >= 500;
  return false;
}

function toSdkMessages(req: GenerateRequest): Anthropic.MessageParam[] {
  return req.messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content
        : (m.content as unknown as Anthropic.ContentBlockParam[]),
  }));
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = modelFor(req.tier ?? "primary");
    const started = Date.now();

    const response = await withRetry(
      () =>
        anthropic().messages.create({
          model,
          max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: req.system,
          messages: toSdkMessages(req),
          // Thinking stays ON. With it disabled, Opus 5 can emit a tool call as
          // visible text instead of a tool_use block -- which would silently
          // break the receptionist's booking path. Cost is controlled with
          // effort instead.
          thinking: { type: "adaptive" },
          output_config: { effort: effortFor(req.tier ?? "primary") },
          ...(req.tools?.length
            ? { tools: req.tools as unknown as Anthropic.Tool[] }
            : {}),
          ...(req.forceTool
            ? { tool_choice: { type: "tool" as const, name: req.forceTool } }
            : {}),
        }),
      { attempts: 3, baseDelayMs: 300, retryOn: isRetryable },
    ).catch((err) => {
      if (err instanceof Anthropic.APIError) {
        throw new AppError("AI_FAILURE", { status: err.status, model }, err);
      }
      throw new AppError("AI_FAILURE", { model }, err);
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const toolCalls: AIToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));

    const inputTokens = response.usage.input_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? 0;

    return {
      text,
      toolCalls,
      stopReason: response.stop_reason ?? "end_turn",
      model: response.model,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd(response.model, inputTokens, outputTokens),
      },
      latencyMs: Date.now() - started,
    };
  }

  async classify<T extends string>(req: {
    tier?: import("../config/models").ModelTier;
    system: string;
    input: string;
    labels: readonly T[];
  }) {
    const tool: AIToolDefinition = {
      name: "record_classification",
      description: "Record the classification decision.",
      input_schema: {
        type: "object",
        properties: {
          label: { type: "string", enum: [...req.labels] },
          reason: { type: "string", description: "One sentence of justification." },
        },
        required: ["label", "reason"],
      },
    };

    const result = await this.generate({
      tier: req.tier ?? "fast",
      system: req.system,
      messages: [{ role: "user", content: req.input }],
      tools: [tool],
      forceTool: tool.name,
      maxTokens: 1024,
    });

    const call = result.toolCalls[0];
    const raw = (call?.input ?? {}) as { label?: string; reason?: string };
    // Never trust the label blindly -- an unknown value falls back to the first
    // declared label rather than propagating an invalid enum into the database.
    const label = req.labels.includes(raw.label as T) ? (raw.label as T) : req.labels[0];

    return {
      label,
      reason: raw.reason ?? "",
      usage: result.usage,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  }

  async extract(req: {
    tier?: import("../config/models").ModelTier;
    system: string;
    input: string;
    schema: AIToolDefinition["input_schema"];
  }) {
    const tool: AIToolDefinition = {
      name: "record_extraction",
      description: "Record the extracted fields.",
      input_schema: req.schema,
    };

    const result = await this.generate({
      tier: req.tier ?? "fast",
      system: req.system,
      messages: [{ role: "user", content: req.input }],
      tools: [tool],
      forceTool: tool.name,
      maxTokens: 2048,
    });

    return {
      data: (result.toolCalls[0]?.input ?? {}) as Record<string, unknown>,
      usage: result.usage,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const model = modelFor(req.tier ?? "primary");
    const stream = anthropic().messages.stream({
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: req.system,
      messages: toSdkMessages(req),
      thinking: { type: "adaptive" },
      output_config: { effort: effortFor(req.tier ?? "primary") },
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
