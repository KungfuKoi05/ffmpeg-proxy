"use client";

import { useCallback, useMemo, useState } from "react";
import {
  parsePageRanges, invertPages, describePages, validatePdfFile, outputPdfName,
} from "@/lib/tools/pdf";
import { formatBytes } from "@/lib/tools/image";
import { FileDrop, FileRow, downloadBlob } from "@/components/file-drop";
import { Panel, Button, Select, ErrorNote, EmptyNote, Label } from "@/components/ui";
import { track } from "@/lib/analytics";

/**
 * pdf-lib is loaded on demand rather than in the page bundle. It is the single
 * heaviest dependency here, and a visitor who came for the word counter should
 * never download it.
 */
async function pdfLib() {
  return import("pdf-lib");
}

interface LoadedPdf {
  file: File;
  pageCount: number;
}

/**
 * A finished document, held in memory until the user clicks Download.
 *
 * We deliberately do NOT auto-download when processing finishes. The browser
 * only honours a programmatic download while the user's click is still
 * "active", and that activation lapses across the awaits needed to parse and
 * rebuild a PDF -- so the file silently never arrives. Handing back a result
 * with its own Download button is both reliable and better UX: you can see
 * what was produced before saving it.
 */
interface PdfResult {
  name: string;
  blob: Blob;
  pageCount: number;
}

function useDocuments(multiple: boolean) {
  const [docs, setDocs] = useState<LoadedPdf[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const add = useCallback(async (incoming: File[]) => {
    setBusy(true);
    const bad: string[] = [];
    const good: LoadedPdf[] = [];

    for (const file of incoming) {
      const check = validatePdfFile(file);
      if (!check.ok) { bad.push(check.error!); continue; }
      try {
        const { PDFDocument } = await pdfLib();
        const bytes = await file.arrayBuffer();
        // Encrypted PDFs throw here; ignoreEncryption lets us read page counts
        // for files that merely have permissions flags set.
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        good.push({ file, pageCount: doc.getPageCount() });
      } catch {
        bad.push(`${file.name} could not be opened — it may be corrupt or password-protected.`);
      }
    }

    setErrors(bad);
    setDocs((cur) => (multiple ? [...cur, ...good] : good.slice(0, 1)));
    setBusy(false);
  }, [multiple]);

  return { docs, setDocs, errors, setErrors, busy, setBusy, add };
}

export function PdfMerge() {
  const { docs, setDocs, errors, setErrors, busy, setBusy, add } = useDocuments(true);
  const [result, setResult] = useState<PdfResult | null>(null);

  const merge = useCallback(async () => {
    if (docs.length < 2) return;
    setBusy(true);
    setErrors([]);
    setResult(null);
    track("conversion_started", { tool: "merge-pdf", count: docs.length });

    try {
      const { PDFDocument } = await pdfLib();
      const out = await PDFDocument.create();
      for (const d of docs) {
        const src = await PDFDocument.load(await d.file.arrayBuffer(), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      setResult({
        name: "merged.pdf",
        blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
        pageCount: out.getPageCount(),
      });
      track("conversion_success", { tool: "merge-pdf" });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Merging failed."]);
      track("conversion_failed", { tool: "merge-pdf" });
    }
    setBusy(false);
  }, [docs, setBusy, setErrors]);

  const totalPages = docs.reduce((s, d) => s + d.pageCount, 0);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= docs.length) return;
    setDocs((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <FileDrop accept="application/pdf,.pdf" multiple disabled={busy} onFiles={add}
        label="Choose PDFs to merge" hint="Two or more files · they combine in the order below" />

      {docs.length > 0 ? (
        <Panel>
          <ul>
            {docs.map((d, i) => (
              <FileRow key={`${d.file.name}-${i}`} name={`${i + 1}. ${d.file.name}`}
                detail={`${d.pageCount} page${d.pageCount === 1 ? "" : "s"} · ${formatBytes(d.file.size)}`}
                onRemove={() => setDocs((cur) => cur.filter((_, x) => x !== i))}
                actions={
                  <span className="flex gap-1">
                    <button onClick={() => move(i, i - 1)} disabled={i === 0}
                      aria-label={`Move ${d.file.name} up`}
                      className="rounded px-2 py-1 text-[13px] text-[var(--ink-3)] hover:bg-[var(--surface-2)] disabled:opacity-30">↑</button>
                    <button onClick={() => move(i, i + 1)} disabled={i === docs.length - 1}
                      aria-label={`Move ${d.file.name} down`}
                      className="rounded px-2 py-1 text-[13px] text-[var(--ink-3)] hover:bg-[var(--surface-2)] disabled:opacity-30">↓</button>
                  </span>
                } />
            ))}
          </ul>
        </Panel>
      ) : null}

      {errors.map((e) => <ErrorNote key={e}>{e}</ErrorNote>)}

      <div className="flex flex-wrap gap-2">
        <Button onClick={merge} disabled={docs.length < 2 || busy}>
          {busy ? "Working…" : `Merge ${docs.length || ""} PDFs`}
        </Button>
        {docs.length ? (
          <Button variant="ghost" onClick={() => { setDocs([]); setResult(null); }} disabled={busy}>
            Clear
          </Button>
        ) : null}
      </div>

      {result ? <PdfResultRow result={result} tool="merge-pdf" /> : null}

      {docs.length === 1 ? <EmptyNote>Add at least one more PDF to merge.</EmptyNote> : null}
      {docs.length > 1 ? <EmptyNote>{totalPages} pages total. Reorder with the arrows.</EmptyNote> : null}
      {!docs.length ? <EmptyNote>Files are combined in your browser — nothing is uploaded.</EmptyNote> : null}
    </div>
  );
}

type SinglePdfMode = "extract" | "delete" | "rotate";

export function PdfPageTool({ mode }: { mode: SinglePdfMode }) {
  const { docs, setDocs, errors, setErrors, busy, setBusy, add } = useDocuments(false);
  const [range, setRange] = useState("");
  const [rotation, setRotation] = useState("90");
  const [result, setResult] = useState<PdfResult | null>(null);

  const doc = docs[0];
  const parsed = doc ? parsePageRanges(range, doc.pageCount) : null;

  // Memoised: a fresh array every render would rebuild the run() callback every
  // render too, which the exhaustive-deps rule correctly flags.
  const kept = useMemo(() => {
    if (!doc || !parsed?.ok) return [] as number[];
    return mode === "delete" ? invertPages(parsed.pages, doc.pageCount) : parsed.pages;
  }, [doc, parsed?.ok, parsed?.pages, mode]);

  const run = useCallback(async () => {
    if (!doc || !parsed?.ok) return;
    if (mode !== "rotate" && kept.length === 0) {
      setErrors(["That would leave the document with no pages."]);
      return;
    }

    setBusy(true);
    setErrors([]);
    setResult(null);
    track("conversion_started", { tool: `${mode}-pdf` });

    try {
      const { PDFDocument, degrees } = await pdfLib();
      const src = await PDFDocument.load(await doc.file.arrayBuffer(), { ignoreEncryption: true });

      let bytes: Uint8Array;
      if (mode === "rotate") {
        // Rotate in place, relative to each page's existing rotation.
        const delta = Number(rotation);
        for (const page of parsed.pages) {
          const p = src.getPage(page - 1);
          p.setRotation(degrees((((p.getRotation().angle + delta) % 360) + 360) % 360));
        }
        bytes = await src.save();
      } else {
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, kept.map((p) => p - 1));
        copied.forEach((p) => out.addPage(p));
        bytes = await out.save();
      }

      const suffix = mode === "rotate" ? "rotated" : mode === "delete" ? "trimmed" : "pages";
      setResult({
        name: outputPdfName(doc.file.name, suffix),
        blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
        pageCount: mode === "rotate" ? doc.pageCount : kept.length,
      });
      track("conversion_success", { tool: `${mode}-pdf` });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "That didn't work."]);
      track("conversion_failed", { tool: `${mode}-pdf` });
    }
    setBusy(false);
  }, [doc, parsed, kept, mode, rotation, setBusy, setErrors]);

  const verb = mode === "extract" ? "Extract" : mode === "delete" ? "Delete" : "Rotate";

  return (
    <div className="space-y-4">
      <FileDrop accept="application/pdf,.pdf" disabled={busy} onFiles={add}
        label={doc ? "Choose a different PDF" : "Choose a PDF"} hint="Up to 100 MB" />

      {doc ? (
        <Panel>
          <ul>
            <FileRow name={doc.file.name}
              detail={`${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"} · ${formatBytes(doc.file.size)}`}
              onRemove={() => { setDocs([]); setRange(""); setErrors([]); setResult(null); }} />
          </ul>
        </Panel>
      ) : null}

      {doc ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Label htmlFor="pdf-range">
              {mode === "delete" ? "Pages to delete" : mode === "rotate" ? "Pages to rotate" : "Pages to keep"}
            </Label>
            <input id="pdf-range" value={range} onChange={(e) => setRange(e.target.value)}
              placeholder={`1-3, 5, 8-  (of ${doc.pageCount})`}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]" />
          </div>
          {mode === "rotate" ? (
            <div className="w-40">
              <Select id="pdf-rot" label="Turn" value={rotation} onChange={setRotation}
                options={[
                  { value: "90", label: "90° right" },
                  { value: "270", label: "90° left" },
                  { value: "180", label: "180°" },
                ]} />
            </div>
          ) : null}
          <Button onClick={run} disabled={busy || !parsed?.ok}>
            {busy ? "Working…" : verb}
          </Button>
        </div>
      ) : null}

      {range && parsed && !parsed.ok ? <ErrorNote>{parsed.error}</ErrorNote> : null}
      {errors.map((e) => <ErrorNote key={e}>{e}</ErrorNote>)}

      {result ? <PdfResultRow result={result} tool={`${mode}-pdf`} /> : null}

      {doc && parsed?.ok ? (
        <EmptyNote>
          {mode === "rotate"
            ? `Rotating page${parsed.pages.length === 1 ? "" : "s"} ${describePages(parsed.pages)}.`
            : `Result will contain ${kept.length} page${kept.length === 1 ? "" : "s"}: ${describePages(kept)}.`}
        </EmptyNote>
      ) : null}

      {!doc ? <EmptyNote>Your PDF is opened and edited in your browser — it is never uploaded.</EmptyNote> : null}
    </div>
  );
}

/** The finished document, with the download tied to a fresh user click. */
function PdfResultRow({ result, tool }: { result: PdfResult; tool: string }) {
  return (
    <Panel>
      <ul>
        <FileRow
          name={result.name}
          detail={`${result.pageCount} page${result.pageCount === 1 ? "" : "s"} · ${formatBytes(result.blob.size)} · ready`}
          actions={
            <Button
              onClick={() => {
                downloadBlob(result.blob, result.name);
                track("download_completed", { tool });
              }}
            >
              Download
            </Button>
          }
        />
      </ul>
    </Panel>
  );
}
