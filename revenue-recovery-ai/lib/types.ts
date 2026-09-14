/** Domain types mirroring supabase/migrations. Kept hand-written so the repo
 *  builds without a live Supabase project to generate against. */

export type MemberRole = "owner" | "admin" | "staff";
export type LeadStatus = "new" | "contacted" | "qualified" | "booked" | "completed" | "lost" | "spam";
export type LeadUrgency = "emergency" | "urgent" | "routine" | "unknown";
export type Channel = "voice" | "sms" | "web";
export type ConversationStatus = "active" | "completed" | "escalated" | "abandoned";
export type MessageDirection = "inbound" | "outbound";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
export type SafetyClass = "SAFE" | "NEEDS_HUMAN" | "HIGH_VALUE" | "RISK" | "SPAM";
export type PlanId = "starter" | "growth" | "pro";

export interface ServiceArea {
  cities: string[];
  zip_codes: string[];
  radius_miles: number | null;
}

export interface BookingAvailability {
  /** ISO weekday numbers, 1 = Monday .. 7 = Sunday. */
  days: number[];
  /** "HH:MM" in the business's timezone. */
  start: string;
  end: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  industry: string;
  address: string | null;
  service_area: ServiceArea;
  timezone: string;
  business_hours: Record<string, { open: string; close: string; closed?: boolean }>;
  emergency_enabled: boolean;
  emergency_instructions: string | null;
  booking_url: string | null;
  booking_availability: BookingAvailability;
  appointment_duration_minutes: number;
  onboarding_completed: boolean;
  ai_enabled: boolean;
  sms_enabled: boolean;
  voice_enabled: boolean;
  booking_enabled: boolean;
  web_chat_enabled: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessService {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category: string | null;
  emergency_available: boolean;
  average_job_value: number;
  active: boolean;
  created_at: string;
}

export interface BusinessFaq {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  active: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  service_requested: string | null;
  urgency: LeadUrgency;
  source: Channel;
  status: LeadStatus;
  estimated_value: number;
  actual_value: number | null;
  ai_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  business_id: string;
  lead_id: string | null;
  channel: Channel;
  external_id: string | null;
  status: ConversationStatus;
  classification: SafetyClass | null;
  escalation_reason: string | null;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  business_id: string;
  direction: MessageDirection;
  sender: string;
  body: string;
  external_message_id: string | null;
  created_at: string;
}

export interface Call {
  id: string;
  business_id: string;
  lead_id: string | null;
  conversation_id: string | null;
  twilio_call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  duration: number | null;
  outcome: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  lead_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  source: Channel;
  notes: string | null;
  created_at: string;
}

export interface RevenueEvent {
  id: string;
  business_id: string;
  lead_id: string | null;
  appointment_id: string | null;
  event_type: string;
  estimated_value: number;
  actual_value: number | null;
  created_at: string;
}

export interface AiAction {
  id: string;
  business_id: string;
  lead_id: string | null;
  conversation_id: string | null;
  agent: string;
  action: string;
  input_summary: string | null;
  output_summary: string | null;
  success: boolean;
  error: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  business_id: string;
  company: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string;
  rating: number | null;
  review_count: number | null;
  services: string[] | null;
  emergency_service: boolean | null;
  website_quality: string | null;
  lead_score: number;
  opportunity_reason: string | null;
  contact_status: string;
  outreach: ProspectOutreach | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectOutreach {
  initial: string;
  follow_up_1: string;
  follow_up_2: string;
  breakup: string;
}
