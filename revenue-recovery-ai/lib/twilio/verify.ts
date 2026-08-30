import twilio from "twilio";
import { AppError } from "../errors";
import { env } from "../env";

/**
 * Twilio webhook signature verification (section 22).
 *
 * Twilio signs the full request URL plus the sorted POST body. Any webhook
 * route that skips this is an open endpoint that anyone can use to forge calls,
 * texts and leads for any tenant -- so this throws rather than returning false.
 */
export function verifyTwilioSignature(input: {
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): void {
  if (!input.signature) {
    throw new AppError("WEBHOOK_SIGNATURE_INVALID", { reason: "missing signature header" });
  }

  const valid = twilio.validateRequest(
    env.twilioAuthToken(),
    input.signature,
    input.url,
    input.params,
  );

  if (!valid) {
    throw new AppError("WEBHOOK_SIGNATURE_INVALID", { reason: "signature mismatch" });
  }
}

/**
 * Reconstructs the URL Twilio signed. Behind Vercel's proxy the incoming
 * request URL can be the internal one, so the public app URL wins when set.
 */
export function webhookUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const incoming = new URL(req.url);
  if (!configured) return incoming.toString();
  const base = new URL(configured);
  incoming.protocol = base.protocol;
  incoming.host = base.host;
  incoming.port = base.port;
  return incoming.toString();
}

export async function parseTwilioForm(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}
