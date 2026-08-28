import Stripe from "stripe";
import { env } from "../env";

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (!cached) {
    cached = new Stripe(env.stripeSecretKey(), { typescript: true });
  }
  return cached;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/** Maps Stripe's status strings onto our enum, defaulting to a safe value. */
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid" {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
      return status;
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "incomplete";
  }
}
