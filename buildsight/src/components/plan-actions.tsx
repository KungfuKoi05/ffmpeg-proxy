"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Starts a Stripe checkout session, or explains why billing is unavailable. */
export function UpgradeButton({
  plan,
  label,
  variant = "primary",
  disabled,
}: {
  plan: "PRO" | "PRO_PLUS";
  label: string;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: { message: string };
      };
      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }
      setMessage(payload.error?.message ?? "Checkout could not be started.");
    } catch {
      setMessage("Checkout could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant={variant} className="w-full" onClick={upgrade} disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
      {message ? <p className="text-[11px] leading-relaxed text-ink-faint">{message}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: { message: string } };
      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }
      setMessage(payload.error?.message ?? "The billing portal is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={open} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null} Manage billing
      </Button>
      {message ? <p className="text-[11px] text-ink-faint">{message}</p> : null}
    </div>
  );
}
