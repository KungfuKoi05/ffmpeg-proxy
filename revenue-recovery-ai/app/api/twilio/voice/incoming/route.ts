import { NextResponse } from "next/server";
import { parseTwilioForm, verifyTwilioSignature, webhookUrl } from "@/lib/twilio/verify";
import { sayAndGather, sayAndHangup, twimlResponse } from "@/lib/twilio/twiml";
import {
  getOrCreateConversation,
  loadKnowledgeBase,
  resolveBusinessByPhone,
  runReceptionistTurn,
} from "@/lib/receptionist/engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/config/features";
import { toPublicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound voice webhook.
 *
 * Twilio posts here on answer, and again for every <Gather> result, so this
 * handler serves both the greeting and each subsequent turn.
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
    const callSid = params.CallSid ?? "";
    const speech = params.SpeechResult?.trim() ?? "";

    const businessId = await resolveBusinessByPhone(to);
    if (!businessId) {
      return twimlResponse(
        sayAndHangup("This number is not configured. Goodbye."),
      );
    }

    const kb = await loadKnowledgeBase(businessId);
    if (!isFeatureEnabled("VOICE_ENABLED") || !kb.business.voice_enabled) {
      return twimlResponse(
        sayAndHangup("Thanks for calling. Please leave us a message or try again later."),
      );
    }

    const conversation = await getOrCreateConversation({
      businessId,
      channel: "voice",
      externalId: callSid,
    });

    const db = supabaseAdmin();
    await db.from("calls").upsert(
      {
        business_id: businessId,
        conversation_id: conversation.id,
        twilio_call_sid: callSid,
        from_number: from,
        to_number: to,
        outcome: "in_progress",
      },
      { onConflict: "twilio_call_sid" },
    );

    const actionUrl = webhookUrl(req);

    // First turn: greet without burning a model call.
    if (!speech) {
      const greeting =
        params.no_input === "1"
          ? "Sorry, I didn't catch that. How can I help you today?"
          : `Thanks for calling ${kb.business.name}. How can I help you today?`;
      return twimlResponse(sayAndGather({ say: greeting, actionUrl }));
    }

    const turn = await runReceptionistTurn({
      businessId,
      conversationId: conversation.id,
      channel: "voice",
      userText: speech,
      callerPhone: from,
      leadId: conversation.leadId,
    });

    if (turn.escalated && kb.business.phone) {
      return twimlResponse(
        `${sayAndHangup(turn.reply)}`.replace(
          "<Hangup/>",
          `<Dial callerId="${to}">${kb.business.phone}</Dial>`,
        ),
      );
    }

    return twimlResponse(sayAndGather({ say: turn.reply, actionUrl }));
  } catch (err) {
    const { status } = toPublicError(err);
    // A signature failure must not return TwiML -- reject outright.
    if (status === 403) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    console.error("[twilio/voice/incoming]", err);
    return twimlResponse(
      sayAndHangup("Sorry, we're having trouble right now. Please call back shortly."),
    );
  }
}
