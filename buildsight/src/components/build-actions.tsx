"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, Download, Trash2, Loader2, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Rename, duplicate, archive, delete and export controls for a saved build. */
export function BuildActions({
  buildId,
  name,
  isArchived,
  canExportPdf,
}: {
  buildId: string;
  name: string;
  isArchived: boolean;
  canExportPdf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(action: string, run: () => Promise<Response>) {
    setBusy(action);
    try {
      const response = await run();
      if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message: string };
        };
        setMessage(payload.error?.message ?? "That action did not complete.");
        return null;
      }
      router.refresh();
      return response;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={async () => {
          const response = await call("duplicate", () =>
            fetch(`/api/builds/${buildId}/duplicate`, { method: "POST" }),
          );
          if (response) {
            const payload = (await response.json()) as { build?: { id: string } };
            if (payload.build) router.push(`/studio/${payload.build.id}`);
          }
        }}
      >
        {busy === "duplicate" ? <Loader2 className="animate-spin" /> : <Copy />} Duplicate
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() =>
          call("archive", () =>
            fetch(`/api/builds/${buildId}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ isArchived: !isArchived }),
            }),
          )
        }
      >
        {busy === "archive" ? (
          <Loader2 className="animate-spin" />
        ) : isArchived ? (
          <ArchiveRestore />
        ) : (
          <Archive />
        )}
        {isArchived ? "Restore" : "Archive"}
      </Button>

      <a href={`/api/builds/${buildId}/export?format=csv`} download>
        <Button size="sm" variant="ghost">
          <Download /> CSV
        </Button>
      </a>
      <a href={`/api/builds/${buildId}/export?format=json`} download>
        <Button size="sm" variant="ghost">
          <Download /> JSON
        </Button>
      </a>
      <a
        href={`/api/builds/${buildId}/export?format=pdf`}
        download
        title={canExportPdf ? undefined : "PDF build sheets are a Pro feature."}
      >
        <Button size="sm" variant="ghost" disabled={!canExportPdf}>
          <Download /> PDF
        </Button>
      </a>

      <Button
        size="sm"
        variant="danger"
        disabled={busy !== null}
        onClick={() => {
          if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
          void call("delete", () => fetch(`/api/builds/${buildId}`, { method: "DELETE" }));
        }}
      >
        {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
      </Button>

      {message ? <span className="text-[11px] text-signal-red">{message}</span> : null}
    </div>
  );
}
