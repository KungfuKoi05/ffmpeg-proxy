"use client";

import { useState } from "react";
import { revenueOpportunity } from "@/lib/revenue";
import { formatCurrency } from "@/lib/utils";

/** Landing-page ROI calculator (section 32). Labelled as opportunity, never
 *  as guaranteed revenue (section 42). */
export function RoiCalculator() {
  const [missedCalls, setMissedCalls] = useState(40);
  const [jobValue, setJobValue] = useState(750);
  const [bookingRate, setBookingRate] = useState(30);

  const opportunity = revenueOpportunity({
    monthlyMissedCalls: missedCalls,
    averageJobValue: jobValue,
    bookableRate: bookingRate / 100,
  });

  return (
    <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <div className="space-y-5">
        <Field
          label="Missed calls per month"
          value={missedCalls}
          min={0}
          max={500}
          step={5}
          onChange={setMissedCalls}
          display={String(missedCalls)}
        />
        <Field
          label="Average job value"
          value={jobValue}
          min={100}
          max={15000}
          step={50}
          onChange={setJobValue}
          display={formatCurrency(jobValue)}
        />
        <Field
          label="Share of missed calls that could be booked"
          value={bookingRate}
          min={5}
          max={80}
          step={5}
          onChange={setBookingRate}
          display={`${bookingRate}%`}
        />
      </div>

      <div className="flex flex-col justify-center rounded-xl bg-brand-50 p-6 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Estimated monthly revenue opportunity
        </div>
        <div className="mt-2 text-4xl font-semibold tabular-nums text-brand-900">
          {formatCurrency(opportunity)}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          An estimate based on the numbers you entered — not a guarantee, and not
          revenue already earned. Your actual result depends on how many of those
          callers convert.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-600"
      />
    </label>
  );
}
