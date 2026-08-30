/**
 * Environment access.
 *
 * Reads are lazy on purpose: `next build` runs without production secrets, so
 * validating at import time would break the build. Each accessor throws only
 * when the feature that needs it is actually exercised.
 */
import { AppError } from "./errors";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new AppError("CONFIG_MISSING", { missing: name });
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: () => optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),

  twilioAccountSid: () => required("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: () => required("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: () => optional("TWILIO_PHONE_NUMBER"),

  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),

  /**
   * "mock" swaps every AI call for a deterministic local adapter. Used by the
   * test suite and by local development without an API key. Production must
   * run "anthropic" -- see lib/ai/index.ts, which refuses mock in production.
   */
  aiProvider: () => optional("AI_PROVIDER", "anthropic"),
} as const;

/** Reports which integrations are configured, without leaking values. */
export function integrationStatus() {
  const has = (n: string) => Boolean(process.env[n]);
  return {
    supabase: has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
    ai: has("ANTHROPIC_API_KEY") || env.aiProvider() === "mock",
    twilio: has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN"),
    stripe: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET"),
  };
}

export const isProduction = () => process.env.NODE_ENV === "production";
