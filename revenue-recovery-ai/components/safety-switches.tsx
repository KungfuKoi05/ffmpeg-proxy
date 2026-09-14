"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Switches = {
  ai_enabled: boolean;
  sms_enabled: boolean;
  voice_enabled: boolean;
  booking_enabled: boolean;
  web_chat_enabled: boolean;
};

const LABELS: Record<keyof Switches, string> = {
  ai_enabled: "AI receptionist",
  voice_enabled: "Answer voice calls",
  sms_enabled: "Send and reply to SMS",
  booking_enabled: "Book appointments automatically",
  web_chat_enabled: "Website chat widget",
};

/** Per-business kill switches (section 27). */
export function SafetySwitches({
  business,
  canEdit,
}: {
  business: Switches;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(business);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: keyof Switches) {
    if (!canEdit) return;
    const next = { ...state, [key]: !state[key] };
    setState(next);
    setBusy(true);
    setError(null);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });

    if (!res.ok) {
      setState(state);
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Could not save.");
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(Object.keys(LABELS) as (keyof Switches)[]).map((key) => (
          <label key={key} className="flex items-center justify-between py-1 text-sm">
            <span className="text-slate-700">{LABELS[key]}</span>
            <input
              type="checkbox"
              checked={state[key]}
              disabled={!canEdit || busy}
              onChange={() => toggle(key)}
              className="h-4 w-4 accent-brand-600"
            />
          </label>
        ))}
        {!canEdit ? (
          <p className="text-xs text-slate-500">Only owners and admins can change these.</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
