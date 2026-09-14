import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  estimateJobValue,
  revenueOpportunity,
} from "@/lib/revenue";

describe("estimateJobValue", () => {
  const services = [
    { name: "AC Repair", average_job_value: 750 },
    { name: "AC Replacement", average_job_value: 8000 },
    { name: "Maintenance", average_job_value: 250 },
  ];

  it("matches a configured service exactly, case-insensitively", () => {
    expect(estimateJobValue("ac repair", services)).toBe(750);
    expect(estimateJobValue("AC Replacement", services)).toBe(8000);
  });

  it("falls back to a partial match", () => {
    expect(estimateJobValue("AC Repair - no cooling", services)).toBe(750);
  });

  it("falls back to HVAC defaults when the business has no match", () => {
    expect(estimateJobValue("hvac replacement", [])).toBe(8000);
  });

  it("returns 0 for unknown or empty input rather than guessing", () => {
    expect(estimateJobValue(null, services)).toBe(0);
    expect(estimateJobValue("", services)).toBe(0);
    expect(estimateJobValue("pool cleaning", [])).toBe(0);
  });
});

describe("computeMetrics", () => {
  it("separates estimated from actual revenue", () => {
    const metrics = computeMetrics({
      leads: [
        { status: "booked", estimated_value: 750, actual_value: null },
        { status: "completed", estimated_value: 8000, actual_value: 7500 },
        { status: "new", estimated_value: 250, actual_value: null },
      ],
      missedCalls: 5,
      appointments: 2,
      aiConversations: 3,
      humanEscalations: 1,
      responseSeconds: [10, 20],
    });

    // Estimated counts only booked/completed leads.
    expect(metrics.estimatedRevenue).toBe(8750);
    // Actual counts only human-entered values.
    expect(metrics.actualRevenue).toBe(7500);
    expect(metrics.averageResponseSeconds).toBe(15);
  });

  it("excludes spam from the conversion denominator", () => {
    const metrics = computeMetrics({
      leads: [
        { status: "booked", estimated_value: 100, actual_value: null },
        { status: "spam", estimated_value: 0, actual_value: null },
      ],
      missedCalls: 0,
      appointments: 1,
      aiConversations: 2,
      humanEscalations: 0,
      responseSeconds: [],
    });
    expect(metrics.conversionRate).toBe(1);
    expect(metrics.leadsRecovered).toBe(1);
  });

  it("does not divide by zero with no leads", () => {
    const metrics = computeMetrics({
      leads: [],
      missedCalls: 0,
      appointments: 0,
      aiConversations: 0,
      humanEscalations: 0,
      responseSeconds: [],
    });
    expect(metrics.conversionRate).toBe(0);
    expect(metrics.averageResponseSeconds).toBeNull();
  });
});

describe("revenueOpportunity", () => {
  it("multiplies the three inputs", () => {
    expect(
      revenueOpportunity({ monthlyMissedCalls: 40, averageJobValue: 750, bookableRate: 0.3 }),
    ).toBe(9000);
  });

  it("clamps nonsense inputs instead of returning negatives", () => {
    expect(
      revenueOpportunity({ monthlyMissedCalls: -5, averageJobValue: 750, bookableRate: 0.3 }),
    ).toBe(0);
    expect(
      revenueOpportunity({ monthlyMissedCalls: 10, averageJobValue: 100, bookableRate: 5 }),
    ).toBe(1000);
  });
});
