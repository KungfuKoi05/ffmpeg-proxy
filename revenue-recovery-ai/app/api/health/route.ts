import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health endpoint (section 29). Reports reachability only -- never secrets. */
export async function GET() {
  const configured = integrationStatus();

  let database: "ok" | "error" | "not_configured" = "not_configured";
  if (configured.supabase) {
    try {
      const { error } = await supabaseAdmin()
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .limit(1);
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }

  const status =
    database === "ok" && configured.ai && configured.twilio && configured.stripe
      ? "healthy"
      : database === "error"
        ? "unhealthy"
        : "degraded";

  return NextResponse.json(
    {
      status,
      database,
      ai: configured.ai ? "ok" : "not_configured",
      twilio: configured.twilio ? "ok" : "not_configured",
      stripe: configured.stripe ? "ok" : "not_configured",
      timestamp: new Date().toISOString(),
    },
    { status: status === "unhealthy" ? 503 : 200 },
  );
}
