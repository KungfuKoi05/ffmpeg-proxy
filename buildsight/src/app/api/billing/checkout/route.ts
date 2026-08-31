import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { ok, apiError } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appUrl, isBillingConfigured, priceIdForPlan, stripeClient } from "@/lib/billing/stripe";
import { writeAuditLog, requestIp } from "@/lib/audit";

const schema = z.object({ plan: z.enum(["PRO", "PRO_PLUS"]) });

/** POST /api/billing/checkout — start a subscription checkout session. */
export const POST = apiRoute(async (request) => {
  const user = await requireUser();
  const body = schema.parse(await request.json());

  const stripe = stripeClient();
  if (!stripe || !isBillingConfigured()) {
    return apiError(
      "BILLING_NOT_CONFIGURED",
      "Billing is not configured on this deployment. Set STRIPE_SECRET_KEY and the plan price ids to enable checkout.",
      501,
    );
  }

  const priceId = priceIdForPlan(body.plan);
  if (!priceId) {
    return apiError("PRICE_NOT_CONFIGURED", `No Stripe price id is configured for ${body.plan}.`, 501);
  }

  let customerId = (
    await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } })
  )?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/account?checkout=success`,
    cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: { userId: user.id, plan: body.plan },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "billing.checkout_started",
    entityType: "User",
    entityId: user.id,
    after: { plan: body.plan },
    ip: requestIp(request),
  });

  return ok({ url: session.url });
});
