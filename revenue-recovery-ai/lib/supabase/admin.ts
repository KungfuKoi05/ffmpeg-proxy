import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Service-role client. Bypasses RLS -- use ONLY in server contexts that do
 * their own tenant resolution (Twilio/Stripe webhooks, cron jobs, seeds).
 * Never import this into anything that runs on a user's request without an
 * explicit business_id derived server-side.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
