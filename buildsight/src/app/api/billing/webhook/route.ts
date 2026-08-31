import type Stripe from "stripe";
import { apiError, ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { planForPriceId, stripeClient } from "@/lib/billing/stripe";
import { writeAuditLog } from "@/lib/audit";

/**
 * POST /api/billing/webhook — Stripe subscription lifecycle.
 *
 * Deliberately outside `apiRoute`: Stripe is a cross-origin caller and the
 * request is authenticated by its signature over the raw body, so the shared
 * same-origin guard must not apply.
 */
export async function POST(request: Request): Promise<Response> {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return apiError("BILLING_NOT_CONFIGURED", "Stripe webhooks are not configured.", 501);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return apiError("MISSING_SIGNATURE", "Missing stripe-signature header.", 400);

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    console.error("[billing] signature verification failed", error);
    return apiError("INVALID_SIGNATURE", "Signature verification failed.", 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const plan = session.metadata?.plan;
      if (userId && (plan === "PRO" || plan === "PRO_PLUS")) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : undefined,
          },
        });
        await writeAuditLog({
          actorId: userId,
          action: "billing.plan_activated",
          entityType: "User",
          entityId: userId,
          after: { plan },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = planForPriceId(priceId);
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (plan && customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: subscription.status === "active" || subscription.status === "trialing" ? plan : "FREE",
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: "FREE", planRenewsAt: null },
        });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return ok({ received: true });
}
