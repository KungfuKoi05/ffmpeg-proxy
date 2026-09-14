import type { PlanId } from "../types";

/**
 * Single source of truth for plans. Price IDs come from the environment so the
 * same build runs against Stripe test and live modes (section 41).
 */
export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** USD per month, for display only. Stripe is authoritative for charging. */
  monthlyPrice: number;
  priceIdEnvVar: string;
  features: string[];
  limits: {
    aiConversations: number;
    smsSegments: number;
    voiceMinutes: number;
  };
  webChat: boolean;
  advancedReporting: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 499,
    priceIdEnvVar: "STRIPE_STARTER_PRICE_ID",
    features: [
      "1 business",
      "AI receptionist",
      "SMS follow-up",
      "Lead management",
      "Dashboard",
    ],
    limits: { aiConversations: 500, smsSegments: 2000, voiceMinutes: 750 },
    webChat: false,
    advancedReporting: false,
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyPrice: 799,
    priceIdEnvVar: "STRIPE_GROWTH_PRICE_ID",
    features: [
      "Everything in Starter",
      "Increased usage limits",
      "Website chat widget",
      "Advanced reporting",
    ],
    limits: { aiConversations: 1500, smsSegments: 6000, voiceMinutes: 2000 },
    webChat: true,
    advancedReporting: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 1299,
    priceIdEnvVar: "STRIPE_PRO_PRICE_ID",
    features: [
      "Everything in Growth",
      "Priority support",
      "Advanced automation",
      "Highest usage limits",
    ],
    limits: { aiConversations: 4000, smsSegments: 15000, voiceMinutes: 5000 },
    webChat: true,
    advancedReporting: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"];

export function planPriceId(plan: PlanId): string | undefined {
  return process.env[PLANS[plan].priceIdEnvVar];
}

/** Reverse lookup for the Stripe webhook: price ID -> plan. */
export function planFromPriceId(priceId: string): PlanId | null {
  for (const plan of PLAN_ORDER) {
    if (process.env[PLANS[plan].priceIdEnvVar] === priceId) return plan;
  }
  return null;
}

export function isPlanId(value: string): value is PlanId {
  return value === "starter" || value === "growth" || value === "pro";
}
