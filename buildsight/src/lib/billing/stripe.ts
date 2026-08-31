/**
 * Stripe integration.
 *
 * Billing is optional: without STRIPE_SECRET_KEY the app runs in an explicit
 * "not configured" mode where plan changes are refused with a clear message
 * rather than silently upgrading anyone. Every entitlement is enforced
 * server-side from the User.plan column, so the billing provider can be
 * swapped without touching feature gates.
 */

import Stripe from "stripe";
import type { Plan } from "@prisma/client";

let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return client;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Map a plan to its configured Stripe price id. */
export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case "PRO":
      return process.env.STRIPE_PRICE_PRO || null;
    case "PRO_PLUS":
      return process.env.STRIPE_PRICE_PRO_PLUS || null;
    default:
      return null;
  }
}

/** Reverse lookup used by the webhook to resolve a subscription's plan. */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_PRO_PLUS) return "PRO_PLUS";
  return null;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
