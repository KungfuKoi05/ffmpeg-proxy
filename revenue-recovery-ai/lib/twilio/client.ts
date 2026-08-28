import twilio from "twilio";
import { env } from "../env";

let cached: ReturnType<typeof twilio> | null = null;

export function twilioClient() {
  if (!cached) cached = twilio(env.twilioAccountSid(), env.twilioAuthToken());
  return cached;
}

/** True when Twilio credentials are present; used by /api/health. */
export function twilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
