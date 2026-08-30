import { NextResponse } from "next/server";
import { requireBusiness, assertRole } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { normaliseProspectRows, parseCsv, scoreProspect } from "@/lib/prospects/scoring";
import { AppError, toPublicError } from "@/lib/errors";
import { isFeatureEnabled } from "@/lib/config/features";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000;
const MAX_ROWS = 5000;

export async function POST(req: Request) {
  try {
    if (!isFeatureEnabled("PROSPECTING_ENABLED")) {
      throw new AppError("FEATURE_DISABLED", { feature: "prospecting" });
    }

    const ctx = await requireBusiness();
    assertRole(ctx, "admin");
    checkRateLimit({ key: `prospect-import:${ctx.business.id}`, limit: 5, windowMs: 60_000 });

    const text = await req.text();
    if (text.length > MAX_BYTES) {
      throw new AppError("VALIDATION_FAILED", { reason: "file too large" });
    }

    const rows = parseCsv(text);
    if (rows.length > MAX_ROWS) {
      throw new AppError("VALIDATION_FAILED", { reason: `more than ${MAX_ROWS} rows` });
    }

    const { valid, rejected } = normaliseProspectRows(rows);
    if (!valid.length) {
      return NextResponse.json({ imported: 0, rejected });
    }

    const supabase = await supabaseServer();
    const payload = valid.map((row) => {
      const { score, factors } = scoreProspect({
        website: row.website ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
      });
      return {
        business_id: ctx.business.id,
        company: row.company,
        website: row.website ?? null,
        phone: row.phone ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        industry: row.industry ?? "hvac",
        notes: row.notes ?? null,
        lead_score: score,
        // Deterministic reasoning; Mercury enriches this later on request.
        opportunity_reason: factors.map((f) => f.reason).join("; ") || null,
        contact_status: "new",
      };
    });

    const { data, error } = await supabase.from("prospects").insert(payload).select("id");
    if (error) throw new AppError("INTERNAL", { step: "insert_prospects" }, error);

    await auditLog({
      businessId: ctx.business.id,
      userId: ctx.user.id,
      action: "prospects_imported",
      metadata: { imported: data?.length ?? 0, rejected: rejected.length },
    });

    return NextResponse.json({ imported: data?.length ?? 0, rejected });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
