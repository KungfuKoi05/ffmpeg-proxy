"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

/** Watchlist toggle and "add to an existing configuration" control. */
export function ProductActions({
  productId,
  isWatched,
  builds,
  signedIn,
}: {
  productId: string;
  isWatched: boolean;
  builds: Array<{ id: string; name: string }>;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(isWatched);
  const [busy, setBusy] = useState<"watch" | "add" | null>(null);
  const [buildId, setBuildId] = useState(builds[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);

  async function toggleWatch() {
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    setBusy("watch");
    try {
      const response = watched
        ? await fetch(`/api/watchlist/${productId}`, { method: "DELETE" })
        : await fetch("/api/watchlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productId }),
          });
      if (response.ok) {
        setWatched(!watched);
        setMessage(watched ? "Removed from your watchlist." : "Watching for price changes.");
      } else {
        const payload = (await response.json()) as { error?: { message: string } };
        setMessage(payload.error?.message ?? "That did not work.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function addToBuild() {
    if (!buildId) return;
    setBusy("add");
    try {
      const response = await fetch(`/api/builds/${buildId}/components`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (response.ok) {
        router.push(`/studio/${buildId}`);
      } else {
        const payload = (await response.json()) as { error?: { message: string } };
        setMessage(payload.error?.message ?? "Could not add to that configuration.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {builds.length > 0 ? (
        <div className="flex gap-2">
          <Select
            value={buildId}
            onChange={(event) => setBuildId(event.target.value)}
            aria-label="Choose a configuration"
          >
            {builds.map((build) => (
              <option key={build.id} value={build.id}>
                {build.name}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={addToBuild} disabled={busy === "add"}>
            {busy === "add" ? <Loader2 className="animate-spin" /> : <Plus />}
            Add
          </Button>
        </div>
      ) : null}

      <Button variant="secondary" className="w-full" onClick={toggleWatch} disabled={busy === "watch"}>
        {busy === "watch" ? (
          <Loader2 className="animate-spin" />
        ) : watched ? (
          <BookmarkCheck />
        ) : (
          <Bookmark />
        )}
        {watched ? "Watching price" : "Watch price"}
      </Button>

      {message ? <p className="text-[11px] text-ink-muted">{message}</p> : null}
    </div>
  );
}
