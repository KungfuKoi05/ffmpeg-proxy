import { parseTwilioForm, verifyTwilioSignature, webhookUrl } from "@/lib/twilio/verify";
import { NextResponse } from "next/server";
import {
  getOrCreateConversation,
  loadKnowledgeBase,
  resolveBusinessByPhone,
  runReceptionistTurn,
} from "@/lib/receptionist/engine";
import { isFeatureEnabled } from "@/lib/config/features";
import { toPublicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function messagingTwiml(body: string): Response {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}

/** Inbound SMS -- continues the recovery conversation. */
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
    const body = (params.Body ?? "").trim();

    const businessId = await resolveBusinessByPhone(to);
    if (!businessId) return NextResponse.json({ ignored: "unknown number" });

    const kb = await loadKnowledgeBase(businessId);
    if (!isFeatureEnabled("SMS_ENABLED") || !kb.business.sms_enabled) {
      return NextResponse.json({ ignored: "sms disabled" });
    }
    if (!body) return NextResponse.json({ ignored: "empty body" });

    // Honour opt-out before doing anything else.
    if (/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body)) {
      return messagingTwiml("You're unsubscribed and won't receive further messages.");
    }

    const conversation = await getOrCreateConversation({
      businessId,
      channel: "sms",
      externalId: from,
    });

    const turn = await runReceptionistTurn({
      businessId,
      conversationId: conversation.id,
      channel: "sms",
      userText: body,
      callerPhone: from,
      leadId: conversation.leadId,
    });

    // The reply is returned as TwiML so Twilio sends it -- the engine does not
    // double-send. Persisted copy is written by the engine.
    return messagingTwiml(turn.reply);
  } catch (err) {
    const { body, status } = toPublicError(err);
    if (status === 403) return NextResponse.json(body, { status });
    console.error("[twilio/sms/incoming]", err);
    return messagingTwiml(
      "Thanks for your message. Someone from our team will follow up shortly.",
    );
  }
}
