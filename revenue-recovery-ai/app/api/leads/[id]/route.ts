import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { AppError, toPublicError } from "@/lib/errors";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z
    .enum(["new", "contacted", "qualified", "booked", "completed", "lost", "spam"])
    .optional(),
  // Revenue is human-entered only; the AI never writes this field.
  actual_value: z.number().min(0).max(10_000_000).nullable().optional(),
  note: z.string().max(5000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireBusiness();

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", { issues: parsed.error.issues });
    }

    const supabase = await supabaseServer();

    // RLS restricts this to the caller's tenant. Verify existence first so a
    // foreign id returns 404 rather than a silent no-op.
    const { data: existing } = await supabase
      .from("leads")
      .select("id, notes")
      .eq("id", id)
      .maybeSingle();
    if (!existing) throw new AppError("NOT_FOUND");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status) patch.status = parsed.data.status;
    if (parsed.data.actual_value !== undefined) patch.actual_value = parsed.data.actual_value;
    if (parsed.data.note) {
      const stamp = new Date().toISOString();
      patch.notes = `${existing.notes ? `${existing.notes}\n\n` : ""}[${stamp}] ${parsed.data.note}`;
    }

    const { data, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new AppError("INTERNAL", { step: "update_lead" }, error);

    await auditLog({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "lead_updated",
      metadata: { lead_id: id, status: parsed.data.status ?? null },
    });

    return NextResponse.json({ lead: data });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
