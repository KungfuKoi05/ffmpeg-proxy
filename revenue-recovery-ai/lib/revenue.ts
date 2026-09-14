import type { BusinessService, Lead } from "./types";

/**
 * Revenue is ESTIMATED unless a human enters an actual value.
 *
 * Section 14/42: estimated figures must never be presented as booked revenue.
 * Every function here returns estimates explicitly labelled as such, and
 * `actualRevenue` only ever sums human-entered numbers.
 */
export const DEFAULT_HVAC_JOB_VALUES: Record<string, number> = {
  "hvac repair": 750,
  "ac repair": 750,
  "heating repair": 750,
  "hvac replacement": 8000,
  "ac replacement": 8000,
  "system replacement": 8000,
  maintenance: 250,
  "tune-up": 250,
  inspection: 150,
};

/** Matches a requested service to a configured average job value. */
export function estimateJobValue(
  serviceRequested: string | null | undefined,
  services: Pick<BusinessService, "name" | "average_job_value">[],
): number {
  if (!serviceRequested) return 0;
  const needle = serviceRequested.trim().toLowerCase();
  if (!needle) return 0;

  const exact = services.find((s) => s.name.trim().toLowerCase() === needle);
  if (exact) return Number(exact.average_job_value) || 0;

  const partial = services.find((s) => {
    const name = s.name.trim().toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
  if (partial) return Number(partial.average_job_value) || 0;

  for (const [key, value] of Object.entries(DEFAULT_HVAC_JOB_VALUES)) {
    if (needle.includes(key) || key.includes(needle)) return value;
  }
  return 0;
}

export interface RecoveryMetrics {
  missedCalls: number;
  leadsRecovered: number;
  appointments: number;
  /** Sum of estimated_value for booked leads. NOT money in the bank. */
  estimatedRevenue: number;
  /** Sum of human-entered actual_value only. */
  actualRevenue: number;
  conversionRate: number;
  averageResponseSeconds: number | null;
  aiConversations: number;
  humanEscalations: number;
}

const BOOKED_STATUSES = new Set(["booked", "completed"]);

export function computeMetrics(input: {
  leads: Pick<Lead, "status" | "estimated_value" | "actual_value">[];
  missedCalls: number;
  appointments: number;
  aiConversations: number;
  humanEscalations: number;
  responseSeconds: number[];
}): RecoveryMetrics {
  const booked = input.leads.filter((l) => BOOKED_STATUSES.has(l.status));
  const estimatedRevenue = booked.reduce(
    (sum, l) => sum + (Number(l.estimated_value) || 0),
    0,
  );
  const actualRevenue = input.leads.reduce(
    (sum, l) => sum + (Number(l.actual_value) || 0),
    0,
  );

  const qualified = input.leads.filter((l) => l.status !== "spam");
  const conversionRate = qualified.length
    ? booked.length / qualified.length
    : 0;

  const averageResponseSeconds = input.responseSeconds.length
    ? input.responseSeconds.reduce((a, b) => a + b, 0) / input.responseSeconds.length
    : null;

  return {
    missedCalls: input.missedCalls,
    leadsRecovered: qualified.length,
    appointments: input.appointments,
    estimatedRevenue,
    actualRevenue,
    conversionRate,
    averageResponseSeconds,
    aiConversations: input.aiConversations,
    humanEscalations: input.humanEscalations,
  };
}

/** Landing-page ROI calculator (section 42). Opportunity, not a guarantee. */
export function revenueOpportunity(input: {
  monthlyMissedCalls: number;
  averageJobValue: number;
  bookableRate: number;
}): number {
  const rate = Math.min(Math.max(input.bookableRate, 0), 1);
  return Math.max(0, input.monthlyMissedCalls) * rate * Math.max(0, input.averageJobValue);
}
