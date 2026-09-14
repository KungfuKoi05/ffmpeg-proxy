import { NextResponse } from "next/server";
import { parseTwilioForm, verifyTwilioSignature, webhookUrl } from "@/lib/twilio/verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getOrCreateConversation,
  loadKnowledgeBase,
  resolveBusinessByPhone,
} from "@/lib/receptionist/engine";
import { sendSms } from "@/lib/twilio/sms";
import { isFeatureEnabled } from "@/lib/config/features";
import { toPublicError } from "@/lib/errors";
import { logAiAction } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Missed-call recovery (section 11). Creates the lead and opens the SMS
 * conversation; the reply lands on /api/twilio/sms/incoming and the
 * receptionist takes it from there.
 */
export async function POST(req: Request) {
  try {
    const params = await parseTwilioForm(req);
    verifyTwilioSignature({
      signature: req.headers.get("x-twilio-signature"),
      url: webhookUrl(req),
      params,
    });

    const to = params.To ?? "";
    const from = params.From ?? "";
    const callSid = params.CallSid ?? `missed-${Date.now()}`;

    const businessId = await resolveBusinessByPhone(to);
    if (!businessId) return NextResponse.json({ ignored: "unknown number" });

    const kb = await loadKnowledgeBase(businessId);
    const db = supabaseAdmin();

    const { data: lead } = await db
      .from("leads")
      .insert({
        business_id: businessId,
        phone: from,
        source: "voice",
        status: "new",
        urgency: "unknown",
        ai_summary: "Missed call -- SMS recovery started.",
      })
      .select("id")
      .single();

    await db
      .from("calls")
      .upsert(
        {
          business_id: businessId,
          lead_id: lead?.id ?? null,
          twilio_call_sid: callSid,
          from_number: from,
          to_number: to,
          outcome: "missed",
        },
        { onConflict: "twilio_call_sid" },
      );

    if (!isFeatureEnabled("SMS_ENABLED") || !kb.business.sms_enabled) {
      return NextResponse.json({ lead_id: lead?.id ?? null, sms: "disabled" });
    }

    // SMS conversation is keyed by the caller's number so their reply threads.
    const conversation = await getOrCreateConversation({
      businessId,
      channel: "sms",
      externalId: from,
    });
    if (lead?.id) {
      await db.from("conversations").update({ lead_id: lead.id }).eq("id", conversation.id);
    }

    const body = `Hi, this is ${kb.business.name}. Sorry we missed your call. How can we help?`;
    const sent = await sendSms({
      businessId,
      to: from,
      body,
      conversationId: conversation.id,
    });

    await logAiAction({
      businessId,
      leadId: lead?.id ?? null,
      conversationId: conversation.id,
      agent: "receptionist",
      action: "missed_call_recovery",
      inputSummary: `missed call from ${from}`,
      outputSummary: sent.ok ? body : `send failed: ${sent.error}`,
      success: sent.ok,
      error: sent.ok ? undefined : sent.error,
    });

    return NextResponse.json({ lead_id: lead?.id ?? null, sms_sent: sent.ok });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
