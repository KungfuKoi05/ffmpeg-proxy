"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import {
  COMPRESS_PRESETS, assessDocument, judgeResult, RENDER_PRESETS, renderPreset,
  pageImageName, pagesWithinLimit,
  type CompressLevel, type Assessment, type Verdict, type RenderQuality,
} from "@/lib/tools/pdf-render";
import { validatePdfFile, outputPdfName } from "@/lib/tools/pdf";
import { formatBytes } from "@/lib/tools/image";
import { FileDrop, FileRow, downloadBlob } from "@/components/file-drop";
import { Panel, Button, Select, ErrorNote, EmptyNote } from "@/components/ui";
import { track } from "@/lib/analytics";

/**
 * Rasterising tools: compress-a-scan and PDF -> JPG.
 *
 * Both need a real PDF renderer, which pdf-lib is not. pdf.js is pinned to v4
 * on purpose: 5.7.284 calls Map.prototype.getOrInsertComputed, which is absent
 * in Chromium 141, so every render throws
 * "this[#rP].getOrInsertComputed is not a function". Found by driving the
 * spike in a real browser -- no unit test would have caught it.
 *
 * pdf.js and its worker are ~1.7 MB together, so they load on demand. Someone
 * who came for the word counter never downloads them.
 */
type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

async function pdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

/**
 * Opens a document, runs `work`, and always releases the worker.
 *
 * Forgetting destroy() leaks a worker per file, which on a long session is a
 * tab that slowly eats a gigabyte.
 */
async function withDocument<T>(file: File, work: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  try {
    return await work(pdf);
  } finally {
    await pdf.destroy();
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode that page."))),
      "image/jpeg",
      quality,
    );
  });
}

interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
  /** Page size in PDF points, needed to rebuild a same-sized document. */
  pointWidth: number;
  pointHeight: number;
}

async function renderPage(page: PDFPageProxy, scale: number, quality: number): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked canvas rendering.");

  // JPEG has no alpha channel, so anything the PDF leaves transparent would
  // encode as black. Paint the page white first.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await canvasToBlob(canvas, quality);
  const points = page.getViewport({ scale: 1 });
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    pointWidth: points.width,
    pointHeight: points.height,
  };
}

/** How many pages we sample to guess whether a document is a scan. */
const ASSESS_SAMPLE_PAGES = 10;

async function assess(pdf: PDFDocumentProxy): Promise<Assessment> {
  const sample = Math.min(pdf.numPages, ASSESS_SAMPLE_PAGES);
  let items = 0;
  for (let i = 1; i <= sample; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    items += content.items.length;
    page.cleanup();
  }
  return assessDocument(items, sample);
}

interface Progress {
  done: number;
  total: number;
}

function ProgressNote({ progress }: { progress: Progress }) {
  return (
    <p aria-live="polite" className="text-[13.5px] text-[var(--ink-2)]">
      Rendering page {Math.min(progress.done + 1, progress.total)} of {progress.total}…
    </p>
  );
}

/* ------------------------------------------------------------ compress ---- */

interface CompressResult {
  name: string;
  blob: Blob;
  pageCount: number;
  originalBytes: number;
  verdict: Verdict;
}

export function PdfCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<{ pageCount: number; assessment: Assessment } | null>(null);
  const [level, setLevel] = useState<CompressLevel>("balanced");
  const [result, setResult] = useState<CompressResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const reset = () => {
    setFile(null);
    setMeta(null);
    setResult(null);
    setErrors([]);
    setProgress(null);
  };

  const add = useCallback(async (incoming: File[]) => {
    const candidate = incoming[0];
    if (!candidate) return;
    const check = validatePdfFile(candidate);
    if (!check.ok) {
      setErrors([check.error!]);
      return;
    }

    setBusy(true);
    setErrors([]);
    setResult(null);
    setMeta(null);
    try {
      // Read the document once up front so we can tell the visitor what this
      // will do to their file *before* they spend 20 seconds finding out.
      const info = await withDocument(candidate, async (pdf) => {
        const limit = pagesWithinLimit(pdf.numPages);
        if (!limit.ok) throw new Error(limit.error);
        return { pageCount: pdf.numPages, assessment: await assess(pdf) };
      });
      setFile(candidate);
      setMeta(info);
    } catch (err) {
      setFile(null);
      setErrors([
        err instanceof Error && err.message
          ? err.message
          : `${candidate.name} could not be opened — it may be corrupt or password-protected.`,
      ]);
    }
    setBusy(false);
  }, []);

  const run = useCallback(async () => {
    if (!file || !meta) return;
    const preset = COMPRESS_PRESETS[level];

    setBusy(true);
    setErrors([]);
    setResult(null);
    setProgress({ done: 0, total: meta.pageCount });
    track("conversion_started", { tool: "compress-pdf", pages: meta.pageCount, level });

    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();

      await withDocument(file, async (pdf) => {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const rendered = await renderPage(page, preset.scale, preset.quality);
          page.cleanup();

          const image = await out.embedJpg(await rendered.blob.arrayBuffer());
          const target = out.addPage([rendered.pointWidth, rendered.pointHeight]);
          target.drawImage(image, {
            x: 0, y: 0, width: target.getWidth(), height: target.getHeight(),
          });
          setProgress({ done: i, total: pdf.numPages });
        }
      });

      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const verdict = judgeResult(file.size, blob.size);

      setResult({
        name: outputPdfName(file.name, "compressed"),
        blob,
        pageCount: out.getPageCount(),
        originalBytes: file.size,
        verdict,
      });
      track("conversion_success", { tool: "compress-pdf", verdict: verdict.kind, level });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Compressing failed."]);
      track("conversion_failed", { tool: "compress-pdf" });
    }
    setProgress(null);
    setBusy(false);
  }, [file, meta, level]);

  return (
    <div className="space-y-4">
      <FileDrop accept="application/pdf,.pdf" disabled={busy} onFiles={add}
        label={file ? "Choose a different PDF" : "Choose a PDF"}
        hint="Up to 100 MB · works best on scans" />

      {file && meta ? (
        <Panel>
          <ul>
            <FileRow name={file.name}
              detail={`${meta.pageCount} page${meta.pageCount === 1 ? "" : "s"} · ${formatBytes(file.size)}`}
              onRemove={reset} />
          </ul>
        </Panel>
      ) : null}

      {/*
        The warning is the point of this tool. Rasterising a text PDF made a
        4 KB file into 910 KB in testing -- 225x bigger. Saying so before the
        click is worth more than any amount of polish after it.
      */}
      {meta?.assessment.warning ? (
        <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2.5 text-[13px] text-[var(--ink-2)]">
          <strong className="font-semibold">Probably not what you want. </strong>
          {meta.assessment.warning}
        </p>
      ) : null}

      {file && meta ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Select id="pdf-compress-level" label="Quality" value={level}
              onChange={(v) => setLevel(v as CompressLevel)}
              options={Object.values(COMPRESS_PRESETS).map((p) => ({ value: p.level, label: p.label }))} />
          </div>
          <Button onClick={run} disabled={busy}>{busy ? "Working…" : "Compress"}</Button>
        </div>
      ) : null}

      {file && meta ? (
        <EmptyNote>
          {COMPRESS_PRESETS[level].label}: {COMPRESS_PRESETS[level].expectation}.
          {meta.assessment.kind === "scan"
            ? " Text stays as pictures of text either way, because that is what a scan already is."
            : " Selectable text is lost — every page becomes an image."}
        </EmptyNote>
      ) : null}

      {progress ? <ProgressNote progress={progress} /> : null}
      {errors.map((e) => <ErrorNote key={e}>{e}</ErrorNote>)}

      {result ? <CompressOutcome result={result} /> : null}

      {!file ? (
        <EmptyNote>
          Your PDF is opened, rendered and rebuilt in your browser — it is never uploaded.
        </EmptyNote>
      ) : null}
    </div>
  );
}

/**
 * The honest result panel.
 *
 * A file that came out bigger is a failed compression, so it is not offered as
 * a download by default. Other sites hand it over silently and let you
 * discover it later. The file is still there behind an explicit second click,
 * because refusing to give someone their own data would be worse.
 */
function CompressOutcome({ result }: { result: CompressResult }) {
  const { verdict } = result;
  const download = () => {
    downloadBlob(result.blob, result.name);
    track("download_completed", { tool: "compress-pdf", verdict: verdict.kind });
  };

  if (verdict.kind === "larger") {
    return (
      <div className="space-y-2">
        <ErrorNote>
          That made it {verdict.grewPercent >= 100
            ? `${Math.round(verdict.grewPercent / 100 + 1)}× bigger`
            : `${verdict.grewPercent.toFixed(1)}% bigger`} — {formatBytes(result.originalBytes)} became{" "}
          {formatBytes(result.blob.size)}. This PDF is already efficient, so turning its pages into
          images costs more than it saves. Nothing here can shrink it further.
        </ErrorNote>
        <Button variant="ghost" onClick={download}>Download the larger file anyway</Button>
      </div>
    );
  }

  const saved = verdict.savedPercent;
  return (
    <div className="space-y-2">
      {verdict.kind === "marginal" ? (
        <EmptyNote>
          Only {saved.toFixed(1)}% smaller — barely worth the quality loss. Try “Smallest file”, or
          keep the original.
        </EmptyNote>
      ) : null}
      <Panel>
        <ul>
          <FileRow
            name={result.name}
            detail={`${formatBytes(result.originalBytes)} → ${formatBytes(result.blob.size)} · ${saved.toFixed(1)}% smaller · ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}`}
            actions={<Button onClick={download}>Download</Button>}
          />
        </ul>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------- pdf -> jpg ---- */

interface PageImage {
  page: number;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

/**
 * Gap between the downloads in "Download all".
 *
 * Browsers throttle a burst of programmatic downloads from a single click;
 * spacing them out keeps every file arriving. Chrome also asks once for
 * permission to download multiple files, which is expected.
 */
const DOWNLOAD_GAP_MS = 150;

export function PdfToJpg() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [quality, setQuality] = useState<RenderQuality>("screen");
  const [images, setImages] = useState<PageImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  // Every preview holds a blob alive; leaving them dangling across several
  // documents is a genuine leak.
  const imagesRef = useRef<PageImage[]>([]);
  imagesRef.current = images;
  const revokeAll = () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  useEffect(() => () => revokeAll(), []);

  const add = useCallback(async (incoming: File[]) => {
    const candidate = incoming[0];
    if (!candidate) return;
    const check = validatePdfFile(candidate);
    if (!check.ok) {
      setErrors([check.error!]);
      return;
    }

    setBusy(true);
    setErrors([]);
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    try {
      const count = await withDocument(candidate, async (pdf) => {
        const limit = pagesWithinLimit(pdf.numPages);
        if (!limit.ok) throw new Error(limit.error);
        return pdf.numPages;
      });
      setFile(candidate);
      setPageCount(count);
    } catch (err) {
      setFile(null);
      setPageCount(0);
      setErrors([
        err instanceof Error && err.message
          ? err.message
          : `${candidate.name} could not be opened — it may be corrupt or password-protected.`,
      ]);
    }
    setBusy(false);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    const preset = renderPreset(quality);

    setBusy(true);
    setErrors([]);
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    setProgress({ done: 0, total: pageCount });
    track("conversion_started", { tool: "pdf-to-jpg", pages: pageCount, quality });

    try {
      await withDocument(file, async (pdf) => {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const rendered = await renderPage(page, preset.scale, preset.quality);
          page.cleanup();

          const image: PageImage = {
            page: i,
            name: pageImageName(file.name, i, pdf.numPages),
            blob: rendered.blob,
            width: rendered.width,
            height: rendered.height,
            previewUrl: URL.createObjectURL(rendered.blob),
          };
          // Appended as they finish, so a 40-page document shows progress you
          // can actually look at rather than a spinner.
          setImages((cur) => [...cur, image]);
          setProgress({ done: i, total: pdf.numPages });
        }
      });
      track("conversion_success", { tool: "pdf-to-jpg" });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Converting failed."]);
      track("conversion_failed", { tool: "pdf-to-jpg" });
    }
    setProgress(null);
    setBusy(false);
  }, [file, pageCount, quality]);

  const downloadAll = useCallback(async () => {
    for (const [index, image] of images.entries()) {
      downloadBlob(image.blob, image.name);
      if (index < images.length - 1) {
        await new Promise((r) => setTimeout(r, DOWNLOAD_GAP_MS));
      }
    }
    track("download_completed", { tool: "pdf-to-jpg", count: images.length });
  }, [images]);

  const totalBytes = images.reduce((sum, i) => sum + i.blob.size, 0);

  return (
    <div className="space-y-4">
      <FileDrop accept="application/pdf,.pdf" disabled={busy} onFiles={add}
        label={file ? "Choose a different PDF" : "Choose a PDF"}
        hint="Up to 100 MB · one JPG per page" />

      {file ? (
        <Panel>
          <ul>
            <FileRow name={file.name}
              detail={`${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatBytes(file.size)}`}
              onRemove={() => {
                revokeAll();
                setFile(null);
                setPageCount(0);
                setImages([]);
                setErrors([]);
              }} />
          </ul>
        </Panel>
      ) : null}

      {file ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Select id="pdf-jpg-quality" label="Resolution" value={quality}
              onChange={(v) => setQuality(v as RenderQuality)}
              options={RENDER_PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
          </div>
          <Button onClick={run} disabled={busy}>
            {busy ? "Working…" : `Convert ${pageCount} page${pageCount === 1 ? "" : "s"}`}
          </Button>
          {images.length ? (
            <Button variant="ghost" onClick={downloadAll} disabled={busy}>
              Download all {images.length}
            </Button>
          ) : null}
        </div>
      ) : null}

      {file ? <EmptyNote>{renderPreset(quality).hint}.</EmptyNote> : null}

      {progress ? <ProgressNote progress={progress} /> : null}
      {errors.map((e) => <ErrorNote key={e}>{e}</ErrorNote>)}

      {images.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <figure key={image.page} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl} alt={`Page ${image.page}`}
                  className="mb-2 w-full rounded border border-[var(--line-2)] bg-white" />
                <figcaption className="text-[12px] text-[var(--ink-3)]">
                  Page {image.page} · {image.width}×{image.height} · {formatBytes(image.blob.size)}
                </figcaption>
                <Button variant="ghost" className="mt-1.5 w-full"
                  onClick={() => {
                    downloadBlob(image.blob, image.name);
                    track("download_completed", { tool: "pdf-to-jpg", count: 1 });
                  }}>
                  Download
                </Button>
              </figure>
            ))}
          </div>
          <EmptyNote>
            {images.length} image{images.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} in total.
            Downloading all of them at once may make your browser ask permission for multiple files.
          </EmptyNote>
        </>
      ) : null}

      {!file ? (
        <EmptyNote>Pages are rendered in your browser — the PDF is never uploaded.</EmptyNote>
      ) : null}
    </div>
  );
}
