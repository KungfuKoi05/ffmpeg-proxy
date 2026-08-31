import { apiRoute } from "@/lib/api/handler";
import { ok, apiError } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appUrl, stripeClient } from "@/lib/billing/stripe";

/** POST /api/billing/portal — open the Stripe customer portal. */
export const POST = apiRoute(async () => {
  const user = await requireUser();
  const stripe = stripeClient();
  if (!stripe) {
    return apiError("BILLING_NOT_CONFIGURED", "Billing is not configured on this deployment.", 501);
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });
  if (!record?.stripeCustomerId) {
    return apiError("NO_CUSTOMER", "No billing customer exists for this account yet.", 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: `${appUrl()}/account`,
  });
  return ok({ url: session.url });
});
