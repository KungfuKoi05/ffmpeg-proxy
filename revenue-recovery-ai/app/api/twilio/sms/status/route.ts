import { NextResponse } from "next/server";
import { parseTwilioForm, verifyTwilioSignature, webhookUrl } from "@/lib/twilio/verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toPublicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delivery receipts. Failures are surfaced on the system-health page. */
export async function POST(req: Request) {
  try {
    const params = await parseTwilioForm(req);
    verifyTwilioSignature({
      signature: req.headers.get("x-twilio-signature"),
      url: webhookUrl(req),
      params,
    });

    const sid = params.MessageSid ?? "";
    const status = params.MessageStatus ?? "";

    if (sid && ["failed", "undelivered"].includes(status)) {
      const db = supabaseAdmin();
      const { data: message } = await db
        .from("messages")
        .select("business_id")
        .eq("external_message_id", sid)
        .maybeSingle();

      if (message?.business_id) {
        await db.from("audit_logs").insert({
          business_id: message.business_id,
          action: "sms_delivery_failed",
          metadata: { sid, status, error_code: params.ErrorCode ?? null },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
