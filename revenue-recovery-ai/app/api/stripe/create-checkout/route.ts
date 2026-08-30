import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe/client";
import { requireBusiness, assertRole } from "@/lib/auth/session";
import { planPriceId, isPlanId } from "@/lib/config/plans";
import { AppError, toPublicError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ plan: z.string() });

export async function POST(req: Request) {
  try {
    // Tenant comes from the session, never from the request body.
    const ctx = await requireBusiness();
    assertRole(ctx, "admin");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success || !isPlanId(parsed.data.plan)) {
      throw new AppError("VALIDATION_FAILED", { field: "plan" });
    }
    const plan = parsed.data.plan;

    const priceId = planPriceId(plan);
    if (!priceId) throw new AppError("CONFIG_MISSING", { plan });

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: ctx.user.email,
        name: ctx.business.name,
        // business_id is the join key the webhook trusts.
        metadata: { business_id: ctx.business.id },
      });
      customerId = customer.id;
      await db.from("subscriptions").upsert(
        {
          business_id: ctx.business.id,
          stripe_customer_id: customerId,
          plan,
          status: "incomplete",
        },
        { onConflict: "business_id" },
      );
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.appUrl()}/billing?checkout=success`,
      cancel_url: `${env.appUrl()}/billing?checkout=cancelled`,
      metadata: { business_id: ctx.business.id, plan },
      subscription_data: { metadata: { business_id: ctx.business.id, plan } },
    });

    await auditLog({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "checkout_started",
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
