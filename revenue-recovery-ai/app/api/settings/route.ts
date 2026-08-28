import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness, assertRole } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { AppError, toPublicError } from "@/lib/errors";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only these fields are settable here. Anything else in the body is ignored,
// so a crafted request cannot flip onboarding_completed or change owner_id.
const schema = z.object({
  ai_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  voice_enabled: z.boolean().optional(),
  booking_enabled: z.boolean().optional(),
  web_chat_enabled: z.boolean().optional(),
  emergency_enabled: z.boolean().optional(),
  emergency_instructions: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await requireBusiness();
    assertRole(ctx, "admin");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", { issues: parsed.error.issues });
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new AppError("VALIDATION_FAILED", { reason: "no supported fields" });
    }

    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("businesses")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", ctx.business.id);

    if (error) throw new AppError("INTERNAL", { step: "update_settings" }, error);

    await auditLog({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "settings_updated",
      metadata: parsed.data,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
