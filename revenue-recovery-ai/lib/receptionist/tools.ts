import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { findConflict, generateSlots } from "../appointments";
import { estimateJobValue } from "../revenue";
import { sendSms } from "../twilio/sms";
import { recordUsage } from "../usage";
import type { AIToolDefinition } from "../ai/types";
import type { Appointment, LeadUrgency } from "../types";
import type { KnowledgeBase } from "./prompt";

/**
 * Receptionist tools (section 9).
 *
 * Every executor returns a plain string that becomes the tool_result. Results
 * state plainly whether the operation SUCCEEDED or FAILED, because the prompt
 * forbids the model from claiming success it did not observe (section 46).
 */
export interface ToolContext {
  businessId: string;
  conversationId: string;
  kb: KnowledgeBase;
  callerPhone: string | null;
  /** Mutated as the conversation creates/updates its lead. */
  leadId: string | null;
  /** Set when the model escalates, so the caller can react after the loop. */
  escalation: { reason: string } | null;
  appointmentCreated: boolean;
  channel: "voice" | "sms" | "web";
}

export const RECEPTIONIST_TOOLS: AIToolDefinition[] = [
  {
    name: "get_business_info",
    description:
      "Get the business name, phone, timezone, service area and whether emergency service is offered.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_services",
    description: "List the services this business offers.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_faq",
    description:
      "Search the business FAQ. Use this before answering any question about policies or how the business operates.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "What the caller asked about." } },
      required: ["query"],
    },
  },
  {
    name: "check_business_hours",
    description: "Check whether the business is currently open and return its weekly hours.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "check_availability",
    description:
      "Get real bookable appointment slots. You MUST call this before offering any time to the caller.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_lead",
    description:
      "Record the caller as a lead. Call this as soon as you know what service they need, even if details are incomplete.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        service_requested: { type: "string" },
        urgency: { type: "string", enum: ["emergency", "urgent", "routine", "unknown"] },
        summary: { type: "string", description: "One or two sentences on what the caller needs." },
      },
      required: ["service_requested"],
    },
  },
  {
    name: "update_lead",
    description: "Add or correct details on the lead already created in this conversation.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        service_requested: { type: "string" },
        urgency: { type: "string", enum: ["emergency", "urgent", "routine", "unknown"] },
        summary: { type: "string" },
      },
    },
  },
  {
    name: "create_appointment",
    description:
      "Book one of the slots returned by check_availability. Returns FAILED if the slot is taken.",
    input_schema: {
      type: "object",
      properties: {
        start_time: { type: "string", description: "ISO 8601 start time from check_availability." },
        notes: { type: "string" },
      },
      required: ["start_time"],
    },
  },
  {
    name: "send_sms",
    description: "Text the caller a short confirmation or follow-up.",
    input_schema: {
      type: "object",
      properties: { body: { type: "string" } },
      required: ["body"],
    },
  },
  {
    name: "notify_business",
    description: "Alert the business owner about this lead.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand off to a human. Use whenever you are uncertain, the caller is upset, or the request is outside the knowledge base.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

const leadFields = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  service_requested: z.string().max(200).optional(),
  urgency: z.enum(["emergency", "urgent", "routine", "unknown"]).optional(),
  summary: z.string().max(2000).optional(),
});

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<string> {
  const db = supabaseAdmin();

  switch (name) {
    case "get_business_info": {
      const b = ctx.kb.business;
      return JSON.stringify({
        name: b.name,
        phone: b.phone,
        timezone: b.timezone,
        service_area: b.service_area,
        emergency_service: b.emergency_enabled,
      });
    }

    case "get_services":
      return JSON.stringify(
        ctx.kb.services
          .filter((s) => s.active)
          .map((s) => ({
            name: s.name,
            category: s.category,
            emergency_available: s.emergency_available,
            description: s.description,
          })),
      );

    case "get_faq": {
      const query = String((rawInput as { query?: string })?.query ?? "").toLowerCase();
      const terms = query.split(/\s+/).filter((t) => t.length > 3);
      const matches = ctx.kb.faqs
        .filter((f) => f.active)
        .map((f) => {
          const haystack = `${f.question} ${f.answer}`.toLowerCase();
          const score = terms.filter((t) => haystack.includes(t)).length;
          return { faq: f, score };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((m) => ({ question: m.faq.question, answer: m.faq.answer }));

      return matches.length
        ? JSON.stringify(matches)
        : "NO_MATCH: nothing in the knowledge base covers this. Do not guess -- escalate or offer a callback.";
    }

    case "check_business_hours": {
      const b = ctx.kb.business;
      const now = new Date();
      const dayName = now.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: b.timezone,
      }).toLowerCase();
      const today = (b.business_hours ?? {})[dayName];
      const nowHHMM = now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: b.timezone,
      });
      const open =
        today && !today.closed && nowHHMM >= today.open && nowHHMM < today.close;
      return JSON.stringify({
        currently_open: Boolean(open),
        today: today ?? null,
        weekly_hours: b.business_hours,
        emergency_service: b.emergency_enabled,
      });
    }

    case "check_availability": {
      if (!ctx.kb.business.booking_enabled) {
        return "BOOKING_DISABLED: this business is not taking automated bookings. Offer a callback instead.";
      }
      const from = new Date();
      const { data: existing } = await db
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("business_id", ctx.businessId)
        .gte("start_time", from.toISOString());
      const { data: blackouts } = await db
        .from("appointment_blackouts")
        .select("start_time, end_time")
        .eq("business_id", ctx.businessId)
        .gte("end_time", from.toISOString());

      const slots = generateSlots({
        availability: ctx.kb.business.booking_availability,
        durationMinutes: ctx.kb.business.appointment_duration_minutes,
        from,
        days: 7,
        existing: (existing ?? []) as Appointment[],
        blackouts: (blackouts ?? []).map((b) => ({
          start: new Date(b.start_time),
          end: new Date(b.end_time),
        })),
        limit: 4,
      });

      if (!slots.length) {
        return "NO_SLOTS: no availability in the next 7 days. Offer a callback and escalate.";
      }
      return JSON.stringify(
        slots.map((s) => ({ start_time: s.start.toISOString(), end_time: s.end.toISOString() })),
      );
    }

    case "create_lead": {
      const parsed = leadFields.safeParse(rawInput);
      if (!parsed.success) return `FAILED: invalid lead fields (${parsed.error.message})`;
      const f = parsed.data;

      const estimated = estimateJobValue(f.service_requested, ctx.kb.services);
      const { data, error } = await db
        .from("leads")
        .insert({
          business_id: ctx.businessId,
          name: f.name ?? null,
          phone: f.phone ?? ctx.callerPhone,
          email: f.email ?? null,
          address: f.address ?? null,
          service_requested: f.service_requested ?? null,
          urgency: (f.urgency ?? "unknown") as LeadUrgency,
          source: ctx.channel,
          status: "qualified",
          estimated_value: estimated,
          ai_summary: f.summary ?? null,
        })
        .select("id")
        .single();

      if (error || !data) return `FAILED: could not save the lead (${error?.message ?? "unknown"})`;

      ctx.leadId = data.id;
      await db.from("conversations").update({ lead_id: data.id }).eq("id", ctx.conversationId);
      await db.from("revenue_events").insert({
        business_id: ctx.businessId,
        lead_id: data.id,
        event_type: "lead_qualified",
        estimated_value: estimated,
      });

      return `SUCCESS: lead recorded (estimated job value $${estimated}).`;
    }

    case "update_lead": {
      if (!ctx.leadId) return "FAILED: no lead exists yet -- call create_lead first.";
      const parsed = leadFields.safeParse(rawInput);
      if (!parsed.success) return `FAILED: invalid fields (${parsed.error.message})`;
      const f = parsed.data;

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (f.name) patch.name = f.name;
      if (f.phone) patch.phone = f.phone;
      if (f.email) patch.email = f.email;
      if (f.address) patch.address = f.address;
      if (f.urgency) patch.urgency = f.urgency;
      if (f.summary) patch.ai_summary = f.summary;
      if (f.service_requested) {
        patch.service_requested = f.service_requested;
        patch.estimated_value = estimateJobValue(f.service_requested, ctx.kb.services);
      }

      const { error } = await db.from("leads").update(patch).eq("id", ctx.leadId);
      return error ? `FAILED: ${error.message}` : "SUCCESS: lead updated.";
    }

    case "create_appointment": {
      if (!ctx.kb.business.booking_enabled) return "FAILED: booking is disabled for this business.";
      const input = z
        .object({ start_time: z.string(), notes: z.string().max(1000).optional() })
        .safeParse(rawInput);
      if (!input.success) return "FAILED: start_time is required.";

      const start = new Date(input.data.start_time);
      if (Number.isNaN(start.getTime())) return "FAILED: start_time is not a valid date.";
      if (start.getTime() < Date.now()) return "FAILED: that time is in the past.";

      const end = new Date(
        start.getTime() + ctx.kb.business.appointment_duration_minutes * 60_000,
      );

      // Re-check conflicts at write time. The slot list may be stale.
      const { data: existing } = await db
        .from("appointments")
        .select("id, start_time, end_time, status")
        .eq("business_id", ctx.businessId);
      const conflict = findConflict({ start, end }, (existing ?? []) as Appointment[]);
      if (conflict) return "FAILED: that slot was just taken. Offer another time.";

      const { data, error } = await db
        .from("appointments")
        .insert({
          business_id: ctx.businessId,
          lead_id: ctx.leadId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "scheduled",
          source: ctx.channel,
          notes: input.data.notes ?? null,
        })
        .select("id")
        .single();

      if (error || !data) return `FAILED: could not book (${error?.message ?? "unknown"}).`;

      ctx.appointmentCreated = true;

      if (ctx.leadId) {
        const { data: lead } = await db
          .from("leads")
          .update({ status: "booked", updated_at: new Date().toISOString() })
          .eq("id", ctx.leadId)
          .select("estimated_value")
          .single();

        await db.from("revenue_events").insert({
          business_id: ctx.businessId,
          lead_id: ctx.leadId,
          appointment_id: data.id,
          event_type: "appointment_booked",
          estimated_value: Number(lead?.estimated_value ?? 0),
        });
      }

      return `SUCCESS: booked for ${start.toISOString()}.`;
    }

    case "send_sms": {
      if (!ctx.kb.business.sms_enabled) return "FAILED: SMS is disabled for this business.";
      if (!ctx.callerPhone) return "FAILED: no caller phone number is known.";
      const body = String((rawInput as { body?: string })?.body ?? "").slice(0, 480);
      if (!body) return "FAILED: message body was empty.";

      const result = await sendSms({
        businessId: ctx.businessId,
        to: ctx.callerPhone,
        body,
        conversationId: ctx.conversationId,
      });
      return result.ok ? "SUCCESS: text sent." : `FAILED: ${result.error}`;
    }

    case "notify_business": {
      const reason = String((rawInput as { reason?: string })?.reason ?? "New lead");
      const target = ctx.kb.business.phone;
      if (!target) return "FAILED: no business phone number configured.";

      const result = await sendSms({
        businessId: ctx.businessId,
        to: target,
        body: `New lead from your AI receptionist: ${reason}`.slice(0, 300),
        conversationId: ctx.conversationId,
      });
      return result.ok ? "SUCCESS: business notified." : `FAILED: ${result.error}`;
    }

    case "escalate_to_human": {
      const reason = String((rawInput as { reason?: string })?.reason ?? "unspecified");
      ctx.escalation = { reason };

      await db
        .from("conversations")
        .update({
          status: "escalated",
          classification: "NEEDS_HUMAN",
          escalation_reason: reason,
        })
        .eq("id", ctx.conversationId);

      if (ctx.kb.business.phone) {
        await sendSms({
          businessId: ctx.businessId,
          to: ctx.kb.business.phone,
          body: `Escalation from AI receptionist: ${reason}`.slice(0, 300),
          conversationId: ctx.conversationId,
        });
      }
      await recordUsage({
        businessId: ctx.businessId,
        eventType: "ai_conversation",
        quantity: 0,
        estimatedCost: 0,
        metadata: { escalated: true, reason },
      });

      return "SUCCESS: a team member has been notified and will follow up.";
    }

    default:
      return `FAILED: unknown tool "${name}".`;
  }
}
