import { supabaseAdmin } from "../supabase/admin";
import { twilioClient, twilioConfigured } from "./client";
import { withRetry, withTimeout } from "../errors";
import { recordUsage } from "../usage";
import { isFeatureEnabled } from "../config/features";

/**
 * Outbound SMS.
 *
 * Returns a result object instead of throwing: the receptionist surfaces
 * failures to the model as tool_result text so it never tells a caller a text
 * was sent when it was not (section 46).
 */
export interface SendSmsResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

/** Twilio bills per 160-character GSM-7 segment. */
export function smsSegments(body: string): number {
  return Math.max(1, Math.ceil(body.length / 160));
}

export async function sendSms(input: {
  businessId: string;
  to: string;
  body: string;
  conversationId?: string;
  from?: string;
}): Promise<SendSmsResult> {
  if (!isFeatureEnabled("SMS_ENABLED")) {
    return { ok: false, error: "SMS is disabled platform-wide." };
  }
  if (!twilioConfigured()) {
    return { ok: false, error: "Twilio is not configured." };
  }

  const db = supabaseAdmin();
  const from =
    input.from ??
    (await db
      .from("phone_numbers")
      .select("phone_number")
      .eq("business_id", input.businessId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then((r) => r.data?.phone_number)) ??
    process.env.TWILIO_PHONE_NUMBER;

  if (!from) return { ok: false, error: "No sending number configured." };

  try {
    const message = await withRetry(
      () =>
        withTimeout(
          twilioClient().messages.create({ to: input.to, from, body: input.body }),
          10_000,
          "twilio.sms",
        ),
      { attempts: 2, baseDelayMs: 400 },
    );

    if (input.conversationId) {
      await db.from("messages").insert({
        conversation_id: input.conversationId,
        business_id: input.businessId,
        direction: "outbound",
        sender: "ai",
        body: input.body,
        external_message_id: message.sid,
      });
    }

    await recordUsage({
      businessId: input.businessId,
      eventType: "sms_segment",
      quantity: smsSegments(input.body),
      // Twilio US long-code outbound list price at time of writing.
      estimatedCost: smsSegments(input.body) * 0.0079,
      metadata: { sid: message.sid },
    });

    return { ok: true, sid: message.sid };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error("[sms] send failed", reason);
    return { ok: false, error: reason };
  }
}
