"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Target-price editing and removal for one watched product. */
export function WatchlistItemActions({
  productId,
  targetPriceCents,
}: {
  productId: string;
  targetPriceCents: number | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(
    targetPriceCents === null ? "" : (targetPriceCents / 100).toFixed(2),
  );
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  async function save() {
    setBusy("save");
    try {
      const parsed = target.trim() === "" ? null : Math.round(Number(target) * 100);
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          targetPriceCents: Number.isFinite(parsed as number) ? parsed : null,
        }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await fetch(`/api/watchlist/${productId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-faint">
          $
        </span>
        <Input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          inputMode="decimal"
          className="h-8 w-28 pl-6 font-mono text-xs"
          placeholder="Target"
          aria-label="Target price in dollars"
        />
      </div>
      <Button size="sm" variant="secondary" onClick={save} disabled={busy !== null}>
        {busy === "save" ? <Loader2 className="animate-spin" /> : null} Save
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={remove}
        disabled={busy !== null}
        aria-label="Remove from watchlist"
      >
        {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}
