import { env, isProduction } from "../env";
import { AppError } from "../errors";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { AIProvider } from "./types";

export * from "./types";

let provider: AIProvider | null = null;

/**
 * Returns the configured provider.
 *
 * Guard rail: the mock adapter is refused in production. A misconfigured
 * deploy fails loudly here rather than silently answering real customer calls
 * with canned text (section 46).
 */
export function ai(): AIProvider {
  if (provider) return provider;

  const configured = env.aiProvider();
  if (configured === "mock") {
    if (isProduction()) {
      throw new AppError("CONFIG_MISSING", {
        reason: "AI_PROVIDER=mock is not permitted in production",
      });
    }
    provider = new MockProvider();
  } else {
    provider = new AnthropicProvider();
  }
  return provider;
}

/** Test seam so suites can swap providers between cases. */
export function __setProvider(p: AIProvider | null): void {
  provider = p;
}
