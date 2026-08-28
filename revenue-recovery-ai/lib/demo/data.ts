import { computeMetrics } from "../revenue";
import type { OverviewData } from "../dashboard/queries";
import type { Lead } from "../types";

/**
 * Demo dataset (section 33). Fully in-memory so /demo works with no API keys
 * and no database. Every figure here is simulated and the UI labels it as such.
 */
const SERVICES = [
  { name: "AC Repair", value: 750, weight: 5 },
  { name: "AC Replacement", value: 8000, weight: 1 },
  { name: "Heating Repair", value: 750, weight: 3 },
  { name: "Maintenance", value: 250, weight: 4 },
];

const NAMES = [
  "John Smith", "Sarah Jones", "Mike Alvarez", "Dana Whitfield", "Chris Okafor",
  "Priya Raman", "Tom Becker", "Alicia Moreno", "Wes Turner", "Nina Patel",
];

/** Seeded PRNG so the demo is identical on every render and every deploy. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function buildDemoOverview(): OverviewData {
  const rand = makeRandom(42);
  const leads: Lead[] = [];
  const now = Date.now();

  const pool = SERVICES.flatMap((s) => Array<typeof s>(s.weight).fill(s));

  for (let i = 0; i < 31; i++) {
    const service = pool[Math.floor(rand() * pool.length)];
    const daysAgo = Math.floor(rand() * 30);
    const roll = rand();
    const status: Lead["status"] =
      roll < 0.45 ? "booked" : roll < 0.6 ? "completed" : roll < 0.8 ? "qualified" : "new";

    leads.push({
      id: `demo-lead-${i}`,
      business_id: "demo",
      name: NAMES[i % NAMES.length],
      phone: `+1555010${String(i).padStart(2, "0")}`,
      email: null,
      address: "Austin, TX",
      service_requested: service.name,
      urgency: rand() < 0.25 ? "urgent" : "routine",
      source: rand() < 0.7 ? "voice" : "sms",
      status,
      estimated_value: service.value,
      actual_value: status === "completed" ? Math.round(service.value * 0.95) : null,
      ai_summary: `Caller reported an issue requiring ${service.name.toLowerCase()}.`,
      notes: null,
      created_at: new Date(now - daysAgo * 86_400_000).toISOString(),
      updated_at: new Date(now - daysAgo * 86_400_000).toISOString(),
    });
  }

  leads.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const appointments = leads.filter(
    (l) => l.status === "booked" || l.status === "completed",
  ).length;

  const metrics = computeMetrics({
    leads,
    missedCalls: 47,
    appointments,
    aiConversations: 54,
    humanEscalations: 6,
    responseSeconds: [14, 18, 21, 17, 20],
  });

  const buckets = new Map<string, { leads: number; appointments: number; revenue: number }>();
  for (let i = 29; i >= 0; i--) {
    buckets.set(new Date(now - i * 86_400_000).toISOString().slice(0, 10), {
      leads: 0,
      appointments: 0,
      revenue: 0,
    });
  }
  for (const lead of leads) {
    const bucket = buckets.get(lead.created_at.slice(0, 10));
    if (!bucket) continue;
    bucket.leads += 1;
    if (lead.status === "booked" || lead.status === "completed") {
      bucket.appointments += 1;
      bucket.revenue += lead.estimated_value;
    }
  }

  return {
    metrics,
    recentLeads: leads.slice(0, 8),
    series: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
    callOutcomes: [
      { outcome: "answered_by_ai", count: 54 },
      { outcome: "missed", count: 47 },
      { outcome: "escalated", count: 6 },
    ],
  };
}

/** The scripted 3-minute sales demo (section 50). */
export const DEMO_TRANSCRIPT = [
  { speaker: "Customer", text: "My AC isn't cooling and it's 85 degrees inside." },
  {
    speaker: "AI",
    text: "Sorry to hear that — that's uncomfortable. Is the system running at all, or completely off?",
  },
  { speaker: "Customer", text: "It's running but blowing warm air." },
  {
    speaker: "AI",
    text: "Got it. Can I get your name and the address you need us at?",
  },
  { speaker: "Customer", text: "John Smith, 214 Cedar Street in Austin." },
  {
    speaker: "AI",
    text: "Thanks John. I have a technician slot tomorrow between 8 and 10am, or 1 to 3pm. Which works better?",
  },
  { speaker: "Customer", text: "Morning is better." },
  {
    speaker: "AI",
    text: "You're booked for tomorrow, 8 to 10am. I've texted you a confirmation. Anything else I can help with?",
  },
];

export const DEMO_ACTIONS = [
  { agent: "receptionist", action: "create_lead", detail: "AC Repair · urgency: urgent" },
  { agent: "receptionist", action: "check_availability", detail: "4 slots returned" },
  { agent: "receptionist", action: "create_appointment", detail: "Tomorrow 08:00–10:00" },
  { agent: "receptionist", action: "send_sms", detail: "Confirmation sent to +15550100" },
  { agent: "sentinel", action: "classify", detail: "SAFE · no hallucination detected" },
];
