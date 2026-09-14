"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

/** CSV import (section 24). Columns: company, website, phone, city, state,
 *  industry, notes. Import scores rows; it never sends anything. */
export function ProspectImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setResult(null);

    const text = await file.text();
    const res = await fetch("/api/prospects/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "Import failed.");
      setBusy(false);
      return;
    }

    setResult(
      `Imported ${body.imported} prospect(s).` +
        (body.rejected?.length ? ` ${body.rejected.length} row(s) skipped.` : ""),
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Import CSV</label>
          <p className="text-xs text-slate-500">
            Header row: company, website, phone, city, state, industry, notes
          </p>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={onFile}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
        {busy ? <p className="text-sm text-slate-500">Importing...</p> : null}
        {result ? <p className="text-sm text-emerald-700">{result}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
