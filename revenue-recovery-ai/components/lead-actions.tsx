"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadStatus } from "@/lib/types";

const STATUSES: LeadStatus[] = [
  "new", "contacted", "qualified", "booked", "completed", "lost", "spam",
];

/** Manual lead work (section 17): status, notes, and human-entered revenue. */
export function LeadActions({
  leadId,
  status,
  actualValue,
}: {
  leadId: string;
  status: LeadStatus;
  actualValue: number | null;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<LeadStatus>(status);
  const [actual, setActual] = useState(actualValue === null ? "" : String(actualValue));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        actual_value: actual === "" ? null : Number(actual),
        note: note || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Could not save.");
      setBusy(false);
      return;
    }
    setNote("");
    setBusy(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-600">Status</span>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as LeadStatus)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-600">Actual revenue</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            placeholder="Leave blank until the job is paid"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600">Add a note</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </CardContent>
    </Card>
  );
}
