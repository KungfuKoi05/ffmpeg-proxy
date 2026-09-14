import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, mapSubscriptionStatus } from "@/lib/stripe/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { planFromPriceId, isPlanId } from "@/lib/config/plans";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Signature verification is mandatory (section 19): without it
 * anyone could POST a fake subscription and grant themselves a paid plan.
 * Client-side subscription state is never trusted -- this handler is the only
 * writer of the subscriptions table.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Raw body is required; parsing it first would break signature verification.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, env.stripeWebhookSecret());
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = session.metadata?.business_id;
        if (businessId && session.subscription) {
          const subscription = await stripe().subscriptions.retrieve(
            String(session.subscription),
          );
          await upsertSubscription(businessId, subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const businessId = await resolveBusinessId(subscription);
        if (businessId) {
          if (event.type === "customer.subscription.deleted") {
            await supabaseAdmin()
              .from("subscriptions")
              .update({ status: "canceled", updated_at: new Date().toISOString() })
              .eq("business_id", businessId);
            await auditLog({ businessId, action: "subscription_canceled" });
          } else {
            await upsertSubscription(businessId, subscription);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = String(invoice.customer ?? "");
        const { data } = await supabaseAdmin()
          .from("subscriptions")
          .select("business_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (data?.business_id) {
          await supabaseAdmin()
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("business_id", data.business_id);
          await auditLog({
            businessId: data.business_id,
            action: "invoice_payment_failed",
            metadata: { invoice_id: invoice.id },
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want on a transient
    // database failure.
    console.error("[stripe] handler failed", event.type, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

async function resolveBusinessId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.business_id;
  if (fromMetadata) return fromMetadata;

  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("business_id")
    .eq("stripe_customer_id", String(subscription.customer))
    .maybeSingle();
  return data?.business_id ?? null;
}

async function upsertSubscription(
  businessId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const metadataPlan = subscription.metadata?.plan;
  const plan =
    planFromPriceId(priceId) ??
    (metadataPlan && isPlanId(metadataPlan) ? metadataPlan : "starter");

  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  await supabaseAdmin()
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        stripe_customer_id: String(subscription.customer),
        stripe_subscription_id: subscription.id,
        plan,
        status: mapSubscriptionStatus(subscription.status),
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );

  await auditLog({
    businessId,
    action: "subscription_updated",
    metadata: { plan, status: subscription.status },
  });
}
