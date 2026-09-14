import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppError, toPublicError } from "@/lib/errors";
import { auditLog } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(40),
  timezone: z.string().min(1).max(80),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        averageJobValue: z.number().min(0).max(1_000_000),
        emergencyAvailable: z.boolean().optional(),
      }),
    )
    .min(1),
  businessHours: z.object({ open: z.string(), close: z.string() }),
  serviceArea: z.object({ cities: z.array(z.string()) }),
  emergencyEnabled: z.boolean(),
  emergencyInstructions: z.string().max(2000).optional(),
  faqs: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })),
  appointmentDurationMinutes: z.number().int().min(15).max(480),
  phoneNumber: z.string().min(5).max(40),
});

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", { issues: parsed.error.issues });
    }
    const input = parsed.data;

    const supabase = await supabaseServer();
    const businessHours = Object.fromEntries(
      DAYS.map((d) => [d, { open: input.businessHours.open, close: input.businessHours.close }]),
    );

    const fields = {
      name: input.name,
      phone: input.phone,
      timezone: input.timezone,
      industry: "hvac",
      service_area: { cities: input.serviceArea.cities, zip_codes: [], radius_miles: null },
      business_hours: businessHours,
      emergency_enabled: input.emergencyEnabled,
      emergency_instructions: input.emergencyInstructions ?? null,
      appointment_duration_minutes: input.appointmentDurationMinutes,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    let businessId = input.businessId ?? null;

    if (businessId) {
      // RLS ensures the caller can only update a business they administer.
      const { error } = await supabase.from("businesses").update(fields).eq("id", businessId);
      if (error) throw new AppError("FORBIDDEN", { step: "update_business" }, error);
    } else {
      const { data, error } = await supabase
        .from("businesses")
        .insert({ ...fields, owner_id: user.id, slug: slugify(input.name) })
        .select("id")
        .single();
      if (error || !data) throw new AppError("INTERNAL", { step: "create_business" }, error);
      businessId = data.id;

      // The creator becomes owner. Written with the service role because the
      // membership row must exist before RLS will admit the user to it.
      const { error: memberError } = await supabaseAdmin()
        .from("business_members")
        .insert({ business_id: businessId, user_id: user.id, role: "owner" });
      if (memberError) {
        throw new AppError("INTERNAL", { step: "create_membership" }, memberError);
      }
    }

    const db = supabaseAdmin();
    await db.from("business_services").delete().eq("business_id", businessId);
    await db.from("business_services").insert(
      input.services.map((s) => ({
        business_id: businessId,
        name: s.name,
        average_job_value: s.averageJobValue,
        emergency_available: s.emergencyAvailable ?? false,
        active: true,
      })),
    );

    await db.from("business_faqs").delete().eq("business_id", businessId);
    if (input.faqs.length) {
      await db.from("business_faqs").insert(
        input.faqs.map((f) => ({
          business_id: businessId,
          question: f.question,
          answer: f.answer,
          active: true,
        })),
      );
    }

    // A number may only ever map to one tenant -- the unique constraint on
    // phone_numbers.phone_number is what stops call hijacking between tenants.
    const { error: phoneError } = await db.from("phone_numbers").upsert(
      {
        business_id: businessId,
        provider: "twilio",
        phone_number: input.phoneNumber,
        status: "active",
      },
      { onConflict: "phone_number" },
    );
    if (phoneError) {
      throw new AppError("VALIDATION_FAILED", {
        reason: "That phone number is already connected to another account.",
      });
    }

    await auditLog({
      businessId,
      userId: user.id,
      action: "onboarding_completed",
      metadata: { services: input.services.length, faqs: input.faqs.length },
    });

    return NextResponse.json({ business_id: businessId });
  } catch (err) {
    const { body, status } = toPublicError(err);
    return NextResponse.json(body, { status });
  }
}
