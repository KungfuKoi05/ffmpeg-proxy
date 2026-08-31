"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PriceCheckResult } from "@/server/price-monitor";

/** Runs the watchlist price monitor on demand from the admin dashboard. */
export function PriceCheckRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/jobs/price-check", { method: "POST" });
      const payload = (await response.json()) as PriceCheckResult & {
        error?: { message: string };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? "The job did not run.");
        return;
      }
      setResult(payload);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Play />} Run price check
      </Button>
      {result ? (
        <p className="font-mono text-[11px] text-ink-muted">
          {result.watched} watched · {result.changed} changed · {result.notified} notified ·{" "}
          {result.emailsQueued} emails queued
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-signal-red">{error}</p> : null}
    </div>
  );
}
