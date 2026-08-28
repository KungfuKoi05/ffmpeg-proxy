import { estimateCostUsd, modelFor } from "../config/models";
import type {
  AIProvider,
  AIToolCall,
  GenerateRequest,
  GenerateResult,
} from "./types";

/**
 * Deterministic local adapter for tests and for /demo without API keys.
 *
 * This is NOT a fake production path -- lib/ai/index.ts refuses to select it
 * when NODE_ENV is production. It exists so the test suite and the sales demo
 * run offline and produce identical output every time.
 */
function lastUserText(req: GenerateRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content.toLowerCase();
    const text = m.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join(" ");
    if (text) return text.toLowerCase();
  }
  return "";
}

function usage(model: string) {
  return {
    inputTokens: 400,
    outputTokens: 120,
    estimatedCostUsd: estimateCostUsd(model, 400, 120),
  };
}

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = modelFor(req.tier ?? "primary");
    const text = lastUserText(req);
    const toolCalls: AIToolCall[] = [];
    let reply = "Thanks for calling. How can I help you today?";

    if (req.forceTool && req.tools?.length) {
      // Forced-tool path (classify/extract) is handled by those methods.
      toolCalls.push({ id: "mock_forced", name: req.forceTool, input: {} });
    } else if (req.tools?.length) {
      const names = new Set(req.tools.map((t) => t.name));
      // Mirrors the real receptionist flow: capture, then offer booking.
      if (/not cooling|no cool|broken|stopped working|not working|down/.test(text)) {
        if (names.has("create_lead")) {
          toolCalls.push({
            id: "mock_lead",
            name: "create_lead",
            input: {
              name: "Demo Caller",
              phone: "+15550100",
              service_requested: "AC Repair",
              urgency: /85|hot|emergency|no air/.test(text) ? "urgent" : "routine",
            },
          });
        }
        reply =
          "Sorry to hear that. I can get a technician out to look at it. " +
          "Is the system completely down, or running but not cooling?";
      } else if (/book|schedule|appointment|come out|send someone/.test(text)) {
        if (names.has("check_availability")) {
          toolCalls.push({ id: "mock_avail", name: "check_availability", input: {} });
        }
        reply = "I can check what times we have open.";
      } else if (/price|cost|how much|quote/.test(text)) {
        reply =
          "I can't quote a price myself, but I'll have someone from the team " +
          "follow up with exact pricing. Can I get your name and address?";
      }
    }

    return {
      text: reply,
      toolCalls,
      stopReason: toolCalls.length ? "tool_use" : "end_turn",
      model,
      usage: usage(model),
      latencyMs: 5,
    };
  }

  async classify<T extends string>(req: {
    system: string;
    input: string;
    labels: readonly T[];
  }) {
    const model = modelFor("fast");
    const text = req.input.toLowerCase();
    // Deterministic keyword routing across whichever label set was supplied.
    const pick = (candidate: string): T | undefined =>
      req.labels.find((l) => l === candidate);

    let label: T | undefined;
    if (/price|pricing|quote|guarantee|refund|lawyer|complain/.test(text)) {
      label = pick("NEEDS_HUMAN") ?? pick("RISK");
    } else if (/replace|replacement|new system|install/.test(text)) {
      label = pick("HIGH_VALUE");
    } else if (/warranty|extended car|free money|crypto/.test(text)) {
      label = pick("SPAM");
    }

    return {
      label: label ?? req.labels[0],
      reason: "mock classification",
      usage: usage(model),
      model,
      latencyMs: 3,
    };
  }

  async extract(req: { system: string; input: string; schema: unknown }) {
    const model = modelFor("fast");
    const text = req.input;
    const phone = /(\+?\d[\d\s().-]{7,}\d)/.exec(text)?.[1];
    const data: Record<string, unknown> = {};
    if (phone) data.phone = phone.replace(/[^\d+]/g, "");
    if (/ac|air condition|cooling/i.test(text)) data.service_requested = "AC Repair";
    if (/furnace|heat/i.test(text)) data.service_requested = "Heating Repair";
    if (/emergency|urgent|no heat|no air/i.test(text)) data.urgency = "urgent";

    return { data, usage: usage(model), model, latencyMs: 3 };
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const result = await this.generate(req);
    for (const word of result.text.split(" ")) yield `${word} `;
  }
}
