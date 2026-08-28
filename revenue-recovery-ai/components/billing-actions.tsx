"use client";

import { useState } from "react";
import { PLANS, PLAN_ORDER } from "@/lib/config/plans";
import type { PlanId } from "@/lib/types";

export function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: PlanId) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.url) {
      setError(body?.error?.message ?? "Could not start checkout.");
      setBusy(false);
      return;
    }
    window.location.href = body.url;
  }

  async function portal() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.url) {
      setError(body?.error?.message ?? "Could not open the billing portal.");
      setBusy(false);
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hasSubscription ? (
          <button
            onClick={portal}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Manage subscription
          </button>
        ) : null}
        {PLAN_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => checkout(id)}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Subscribe to {PLANS[id].name}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
