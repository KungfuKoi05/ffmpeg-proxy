import { NextResponse } from "next/server";
import { parseTwilioForm, verifyTwilioSignature, webhookUrl } from "@/lib/twilio/verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveBusinessByPhone } from "@/lib/receptionist/engine";
import { recordUsage } from "@/lib/usage";
import { toPublicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Call status callback: records duration, outcome, and voice-minute usage. */
export async function POST(req: Request) {
  try {
    const params = await parseTwilioForm(req);
    verifyTwilioSignature({
      signature: req.headers.get("x-twilio-signature"),
      url: webhookUrl(req),
      params,
    });

    const callSid = params.CallSid ?? "";
    const status = params.CallStatus ?? "";
    const duration = Number(params.CallDuration ?? 0);
    const businessId = await resolveBusinessByPhone(params.To ?? "");

    if (businessId && callSid) {
      const db = supabaseAdmin();
      await db
        .from("calls")
        .update({ duration, outcome: status, recording_url: params.RecordingUrl ?? null })
        .eq("twilio_call_sid", callSid)
        .eq("business_id", businessId);

      if (duration > 0) {
        await recordUsage({
          businessId,
          eventType: "voice_minute",
          quantity: Math.ceil(duration / 60),
          // Twilio inbound local list price at time of writing.
          estimatedCost: Math.ceil(duration / 60) * 0.0085,
          metadata: { call_sid: callSid, status },
        });
      }

      if (["completed", "no-answer", "busy", "failed", "canceled"].includes(status)) {
        await db
          .from("conversations")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("external_id", callSid)
          .eq("business_id", businessId)
          .eq("status", "active");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
