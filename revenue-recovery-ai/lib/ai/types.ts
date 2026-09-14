import type { ModelTier } from "../config/models";

export interface AIMessage {
  role: "user" | "assistant";
  content: string | AIContentBlock[];
}

export type AIContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface AIToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AIToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface GenerateRequest {
  tier?: ModelTier;
  system: string;
  messages: AIMessage[];
  tools?: AIToolDefinition[];
  maxTokens?: number;
  /** Force a specific tool. Used by extract/classify to guarantee shape. */
  forceTool?: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface GenerateResult {
  text: string;
  toolCalls: AIToolCall[];
  /** "refusal" means the model declined -- callers must escalate, not retry. */
  stopReason: string;
  model: string;
  usage: AIUsage;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  classify<T extends string>(req: {
    tier?: ModelTier;
    system: string;
    input: string;
    labels: readonly T[];
  }): Promise<{ label: T; reason: string; usage: AIUsage; model: string; latencyMs: number }>;
  extract(req: {
    tier?: ModelTier;
    system: string;
    input: string;
    schema: AIToolDefinition["input_schema"];
  }): Promise<{ data: Record<string, unknown>; usage: AIUsage; model: string; latencyMs: number }>;
  stream(req: GenerateRequest): AsyncIterable<string>;
}
