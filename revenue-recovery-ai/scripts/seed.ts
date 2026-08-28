/**
 * Seeds a demo tenant with realistic HVAC data (section 35).
 *
 *   npm run db:seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Safe to
 * re-run: it deletes and recreates the business with the demo slug.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.SEED_OWNER_EMAIL;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
if (!ownerEmail) {
  console.error("Set SEED_OWNER_EMAIL to an existing auth user's email.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const DEMO_SLUG = "demo-hvac";

const SERVICES = [
  { name: "AC Repair", average_job_value: 750, emergency_available: true, category: "cooling" },
  { name: "AC Replacement", average_job_value: 8000, emergency_available: false, category: "cooling" },
  { name: "Heating Repair", average_job_value: 750, emergency_available: true, category: "heating" },
  { name: "Maintenance", average_job_value: 250, emergency_available: false, category: "service" },
];

const FAQS = [
  { question: "Do you charge for a diagnostic visit?", answer: "Yes, there is a diagnostic fee. A team member will confirm the exact amount." },
  { question: "What areas do you serve?", answer: "Austin, Round Rock and Pflugerville." },
  { question: "Do you service commercial units?", answer: "Yes, for light commercial rooftop and split systems." },
  { question: "Are you licensed and insured?", answer: "Yes, fully licensed and insured in Texas." },
];

async function main() {
  const { data: users } = await db.from("users").select("id, email").eq("email", ownerEmail);
  const owner = users?.[0];
  if (!owner) {
    console.error(`No user with email ${ownerEmail}. Sign up in the app first.`);
    process.exit(1);
  }

  await db.from("businesses").delete().eq("slug", DEMO_SLUG);

  const { data: business, error } = await db
    .from("businesses")
    .insert({
      owner_id: owner.id,
      name: "Demo Heating & Air",
      slug: DEMO_SLUG,
      phone: "+15125550100",
      industry: "hvac",
      timezone: "America/Chicago",
      service_area: { cities: ["Austin", "Round Rock"], zip_codes: [], radius_miles: 30 },
      business_hours: Object.fromEntries(
        ["monday", "tuesday", "wednesday", "thursday", "friday"].map((d) => [
          d,
          { open: "08:00", close: "17:00" },
        ]),
      ),
      emergency_enabled: true,
      emergency_instructions: "Alert the on-call technician immediately.",
      onboarding_completed: true,
      is_demo: true,
    })
    .select("id")
    .single();

  if (error || !business) throw error ?? new Error("business insert failed");
  const businessId = business.id;

  await db.from("business_members").insert({
    business_id: businessId,
    user_id: owner.id,
    role: "owner",
  });

  const { data: services } = await db
    .from("business_services")
    .insert(SERVICES.map((s) => ({ ...s, business_id: businessId, active: true })))
    .select("id, name, average_job_value");

  await db.from("business_faqs").insert(
    FAQS.map((f) => ({ ...f, business_id: businessId, active: true })),
  );

  const now = Date.now();
  const statuses = ["new", "qualified", "booked", "completed", "lost"] as const;

  for (let i = 0; i < 24; i++) {
    const service = (services ?? [])[i % (services?.length || 1)];
    const status = statuses[i % statuses.length];
    const createdAt = new Date(now - (i % 28) * 86_400_000).toISOString();
    const value = Number(service?.average_job_value ?? 0);

    const { data: lead } = await db
      .from("leads")
      .insert({
        business_id: businessId,
        name: `Demo Customer ${i + 1}`,
        phone: `+1512555${String(1000 + i).slice(-4)}`,
        address: "Austin, TX",
        service_requested: service?.name ?? "AC Repair",
        urgency: i % 4 === 0 ? "urgent" : "routine",
        source: i % 3 === 0 ? "sms" : "voice",
        status,
        estimated_value: value,
        actual_value: status === "completed" ? Math.round(value * 0.95) : null,
        ai_summary: `Caller needed ${service?.name ?? "service"}.`,
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (!lead) continue;

    const { data: conversation } = await db
      .from("conversations")
      .insert({
        business_id: businessId,
        lead_id: lead.id,
        channel: i % 3 === 0 ? "sms" : "voice",
        external_id: `seed-${i}`,
        status: status === "lost" ? "escalated" : "completed",
        classification: status === "lost" ? "NEEDS_HUMAN" : "SAFE",
        started_at: createdAt,
      })
      .select("id")
      .single();

    if (conversation) {
      await db.from("messages").insert([
        {
          conversation_id: conversation.id,
          business_id: businessId,
          direction: "inbound",
          sender: "caller",
          body: "My AC isn't cooling and it's hot inside.",
          created_at: createdAt,
        },
        {
          conversation_id: conversation.id,
          business_id: businessId,
          direction: "outbound",
          sender: "ai",
          body: "Sorry to hear that. Is the system running but not cooling, or completely off?",
          created_at: createdAt,
        },
      ]);
    }

    await db.from("calls").insert({
      business_id: businessId,
      lead_id: lead.id,
      conversation_id: conversation?.id ?? null,
      twilio_call_sid: `SEEDCALL${i}`,
      from_number: `+1512555${String(1000 + i).slice(-4)}`,
      to_number: "+15125550199",
      duration: 60 + i * 3,
      outcome: i % 5 === 0 ? "missed" : "completed",
      created_at: createdAt,
    });

    if (status === "booked" || status === "completed") {
      const start = new Date(now + (i % 10) * 86_400_000);
      start.setUTCHours(14, 0, 0, 0);
      const { data: appt } = await db
        .from("appointments")
        .insert({
          business_id: businessId,
          lead_id: lead.id,
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + 7_200_000).toISOString(),
          status: status === "completed" ? "completed" : "scheduled",
          source: "voice",
        })
        .select("id")
        .single();

      await db.from("revenue_events").insert({
        business_id: businessId,
        lead_id: lead.id,
        appointment_id: appt?.id ?? null,
        event_type: "appointment_booked",
        estimated_value: value,
        actual_value: status === "completed" ? Math.round(value * 0.95) : null,
        created_at: createdAt,
      });
    }

    await db.from("ai_actions").insert({
      business_id: businessId,
      lead_id: lead.id,
      conversation_id: conversation?.id ?? null,
      agent: "receptionist",
      action: "create_lead",
      input_summary: "caller described a fault",
      output_summary: `SUCCESS: lead recorded (estimated $${value}).`,
      success: true,
      model: "claude-opus-5",
      created_at: createdAt,
    });
  }

  await db.from("prospects").insert(
    [
      { company: "Lone Star Air", city: "Austin", state: "TX", phone: "+15125551001", lead_score: 78 },
      { company: "Hill Country HVAC", city: "Round Rock", state: "TX", phone: "+15125551002", lead_score: 65 },
      { company: "Capital Comfort", city: "Austin", state: "TX", phone: "+15125551003", lead_score: 52 },
    ].map((p) => ({ ...p, business_id: businessId, industry: "hvac", contact_status: "new" })),
  );

  await db.from("phone_numbers").upsert(
    {
      business_id: businessId,
      provider: "twilio",
      phone_number: "+15125550199",
      status: "active",
    },
    { onConflict: "phone_number" },
  );

  console.log(`Seeded demo business ${businessId} for ${ownerEmail}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
