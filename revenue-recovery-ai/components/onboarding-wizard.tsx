"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Onboarding wizard (section 20). Activation is gated: the final step refuses
 * to submit until the fields the receptionist actually needs are present, so a
 * half-configured assistant can never go live.
 */
interface ServiceRow {
  name: string;
  averageJobValue: number;
  emergencyAvailable: boolean;
}
interface FaqRow {
  question: string;
  answer: string;
}

const STEPS = [
  "Business",
  "Services",
  "Job values",
  "Hours",
  "Service area",
  "Emergency",
  "FAQs",
  "Booking",
  "Phone",
  "Review",
];

const DEFAULT_SERVICES: ServiceRow[] = [
  { name: "AC Repair", averageJobValue: 750, emergencyAvailable: true },
  { name: "AC Replacement", averageJobValue: 8000, emergencyAvailable: false },
  { name: "Heating Repair", averageJobValue: 750, emergencyAvailable: true },
  { name: "Maintenance", averageJobValue: 250, emergencyAvailable: false },
];

export function OnboardingWizard({
  existingBusinessId,
  existingName,
}: {
  existingBusinessId: string | null;
  existingName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(existingName);
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [services, setServices] = useState<ServiceRow[]>(DEFAULT_SERVICES);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("17:00");
  const [cities, setCities] = useState("");
  const [emergencyEnabled, setEmergencyEnabled] = useState(true);
  const [emergencyInstructions, setEmergencyInstructions] = useState(
    "Take the caller's details and alert the on-call technician immediately.",
  );
  const [faqs, setFaqs] = useState<FaqRow[]>([
    { question: "Do you charge for a diagnostic visit?", answer: "" },
  ]);
  const [duration, setDuration] = useState(120);
  const [twilioNumber, setTwilioNumber] = useState("");

  // Everything the receptionist genuinely needs before it can answer a call.
  const blockers: string[] = [];
  if (!name.trim()) blockers.push("Business name");
  if (!phone.trim()) blockers.push("Business phone (for escalations)");
  if (!services.some((s) => s.name.trim())) blockers.push("At least one service");
  if (!services.some((s) => s.averageJobValue > 0)) blockers.push("At least one average job value");
  if (!cities.trim()) blockers.push("Service area");
  if (!twilioNumber.trim()) blockers.push("A connected phone number");

  async function activate() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: existingBusinessId,
        name,
        phone,
        timezone,
        services: services.filter((s) => s.name.trim()),
        businessHours: { open: openTime, close: closeTime },
        serviceArea: { cities: cities.split(",").map((c) => c.trim()).filter(Boolean) },
        emergencyEnabled,
        emergencyInstructions,
        faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
        appointmentDurationMinutes: duration,
        phoneNumber: twilioNumber,
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "Could not save your setup.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full bg-brand-600 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          {step === 0 && (
            <>
              <Text label="Business name" value={name} onChange={setName} />
              <Text
                label="Business phone (where escalations go)"
                value={phone}
                onChange={setPhone}
                placeholder="+15125550100"
              />
              <Text label="Timezone" value={timezone} onChange={setTimezone} />
            </>
          )}

          {(step === 1 || step === 2) && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {step === 1
                  ? "What do you do? The AI will only offer these."
                  : "Average job value per service. This drives revenue estimates."}
              </p>
              {services.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => {
                      const next = [...services];
                      next[i] = { ...next[i], name: e.target.value };
                      setServices(next);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    placeholder="Service name"
                  />
                  <input
                    type="number"
                    min={0}
                    value={s.averageJobValue}
                    onChange={(e) => {
                      const next = [...services];
                      next[i] = { ...next[i], averageJobValue: Number(e.target.value) };
                      setServices(next);
                    }}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  setServices([...services, { name: "", averageJobValue: 0, emergencyAvailable: false }])
                }
                className="text-sm font-medium text-brand-600"
              >
                + Add service
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-3">
              <Text label="Opens" value={openTime} onChange={setOpenTime} />
              <Text label="Closes" value={closeTime} onChange={setCloseTime} />
            </div>
          )}

          {step === 4 && (
            <Text
              label="Cities you serve (comma separated)"
              value={cities}
              onChange={setCities}
              placeholder="Austin, Round Rock, Pflugerville"
            />
          )}

          {step === 5 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={emergencyEnabled}
                  onChange={(e) => setEmergencyEnabled(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                We offer emergency / after-hours service
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">What should happen on an emergency call?</span>
                <textarea
                  rows={3}
                  value={emergencyInstructions}
                  onChange={(e) => setEmergencyInstructions(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <p className="text-xs text-slate-500">
                For gas leaks, alarms, smoke or medical emergencies the assistant
                always tells the caller to hang up and dial emergency services.
                That behaviour is not configurable.
              </p>
            </>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Anything the AI doesn&apos;t know here, it escalates instead of guessing.
              </p>
              {faqs.map((f, i) => (
                <div key={i} className="space-y-1">
                  <input
                    value={f.question}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[i] = { ...next[i], question: e.target.value };
                      setFaqs(next);
                    }}
                    placeholder="Question"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <textarea
                    rows={2}
                    value={f.answer}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[i] = { ...next[i], answer: e.target.value };
                      setFaqs(next);
                    }}
                    placeholder="Answer"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
              <button
                onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
                className="text-sm font-medium text-brand-600"
              >
                + Add FAQ
              </button>
            </div>
          )}

          {step === 7 && (
            <label className="block text-sm">
              <span className="text-slate-600">Appointment length (minutes)</span>
              <input
                type="number"
                min={30}
                step={30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
          )}

          {step === 8 && (
            <>
              <Text
                label="Your Twilio number"
                value={twilioNumber}
                onChange={setTwilioNumber}
                placeholder="+15125550199"
              />
              <p className="text-xs text-slate-500">
                Buy a number in Twilio, point its voice and messaging webhooks at
                this app, then forward your existing business line to it. Exact
                URLs are in docs/DEPLOYMENT.md.
              </p>
            </>
          )}

          {step === 9 && (
            <div className="space-y-3 text-sm">
              <h2 className="font-semibold">Review</h2>
              <Summary label="Business" value={name || "—"} />
              <Summary label="Escalation phone" value={phone || "—"} />
              <Summary label="Services" value={services.filter((s) => s.name).map((s) => s.name).join(", ") || "—"} />
              <Summary label="Hours" value={`${openTime}–${closeTime} ${timezone}`} />
              <Summary label="Service area" value={cities || "—"} />
              <Summary label="Emergency" value={emergencyEnabled ? "offered" : "not offered"} />
              <Summary label="Connected number" value={twilioNumber || "—"} />

              {blockers.length > 0 ? (
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900">
                  <p className="font-medium">Still needed before activation:</p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-900">
                  Ready to activate.
                </p>
              )}
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
              >
                Next
              </button>
            ) : (
              <button
                onClick={activate}
                disabled={busy || blockers.length > 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Activating..." : "Activate"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
