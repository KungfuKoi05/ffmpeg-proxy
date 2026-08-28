import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { requireBusiness, assertRole } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppError, toPublicError } from "@/lib/errors";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Billing portal -- where customers upgrade, change card, or cancel. */
export async function POST() {
  try {
    const ctx = await requireBusiness();
    assertRole(ctx, "admin");

    const { data } = await supabaseAdmin()
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("business_id", ctx.business.id)
      .maybeSingle();

    if (!data?.stripe_customer_id) {
      throw new AppError("NOT_FOUND", { reason: "no stripe customer" });
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${env.appUrl()}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
