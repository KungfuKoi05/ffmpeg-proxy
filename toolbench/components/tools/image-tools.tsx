"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeResizeDimensions, formatBytes, savingsPercent, outputFilename,
  validateImageFile, supportsQuality, mimeFor, OUTPUT_FORMATS,
  type ImageFormat,
} from "@/lib/tools/image";
import { FileDrop, FileRow, downloadBlob } from "@/components/file-drop";
import {
  Panel, Button, NumberField, Select, Toggle, ErrorNote, EmptyNote, Label,
} from "@/components/ui";
import { track } from "@/lib/analytics";

interface Processed {
  id: string;
  name: string;
  outName: string;
  originalSize: number;
  newSize: number;
  width: number;
  height: number;
  blob: Blob;
  previewUrl: string;
}

/** Decodes a file into a bitmap without ever leaving the page. */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read that image — it may be corrupt."));
      img.src = url;
    });
    return img;
  } finally {
    // The bitmap is decoded by now; the object URL can go.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode that image."))),
      mime,
      quality,
    );
  });
}

type Mode = "compress" | "resize" | "convert";

export function ImageTool({ mode, fixedFormat }: { mode: Mode; fixedFormat?: ImageFormat }) {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Processed[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [format, setFormat] = useState<ImageFormat>(fixedFormat ?? "jpeg");
  const [quality, setQuality] = useState(80);
  const [width, setWidth] = useState<number>(NaN);
  const [height, setHeight] = useState<number>(NaN);
  const [percent, setPercent] = useState<number>(NaN);
  const [maintain, setMaintain] = useState(true);

  const resultsRef = useRef<Processed[]>([]);
  resultsRef.current = results;
  // Object URLs are a real leak if left dangling across many batches.
  useEffect(() => () => {
    resultsRef.current.forEach((r) => URL.revokeObjectURL(r.previewUrl));
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    const good: File[] = [];
    const bad: string[] = [];
    for (const f of incoming) {
      const check = validateImageFile(f);
      if (check.ok) good.push(f);
      else bad.push(check.error!);
    }
    setErrors(bad);
    setFiles((cur) => [...cur, ...good]);
  }, []);

  const run = useCallback(async () => {
    if (!files.length) return;
    setBusy(true);
    setErrors([]);
    track("conversion_started", { tool: mode, count: files.length });

    const out: Processed[] = [];
    const failed: string[] = [];

    for (const file of files) {
      try {
        const img = await loadImage(file);
        const target = mode === "resize"
          ? computeResizeDimensions(
              { width: img.naturalWidth, height: img.naturalHeight },
              { width, height, percent, maintainAspect: maintain },
            )
          : { width: img.naturalWidth, height: img.naturalHeight };

        const canvas = document.createElement("canvas");
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked canvas rendering.");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, target.width, target.height);

        const outFormat = fixedFormat ?? format;
        const blob = await canvasToBlob(
          canvas,
          mimeFor(outFormat),
          supportsQuality(outFormat) ? quality / 100 : 1,
        );

        out.push({
          id: `${file.name}-${out.length}`,
          name: file.name,
          outName: outputFilename(file.name, outFormat, mode === "resize" ? "-resized" : ""),
          originalSize: file.size,
          newSize: blob.size,
          width: target.width,
          height: target.height,
          blob,
          previewUrl: URL.createObjectURL(blob),
        });
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    results.forEach((r) => URL.revokeObjectURL(r.previewUrl));
    setResults(out);
    setErrors(failed);
    setBusy(false);
    track(out.length ? "conversion_success" : "conversion_failed", { tool: mode, count: out.length });
  }, [files, mode, width, height, percent, maintain, format, fixedFormat, quality, results]);

  const totalIn = results.reduce((s, r) => s + r.originalSize, 0);
  const totalOut = results.reduce((s, r) => s + r.newSize, 0);
  const saved = savingsPercent(totalIn, totalOut);

  return (
    <div className="space-y-4">
      <FileDrop
        accept="image/*"
        multiple
        disabled={busy}
        onFiles={addFiles}
        label="Choose images"
        hint="JPG, PNG, WebP, GIF, BMP or AVIF · up to 50 MB each"
      />

      {files.length > 0 ? (
        <Panel>
          <ul>
            {files.map((f, i) => (
              <FileRow key={`${f.name}-${i}`} name={f.name} detail={formatBytes(f.size)}
                onRemove={() => setFiles((cur) => cur.filter((_, x) => x !== i))} />
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {mode === "resize" ? (
          <>
            <div className="w-28"><NumberField id="im-w" label="Width" value={width} onChange={setWidth} min={1} suffix="px" /></div>
            <div className="w-28"><NumberField id="im-h" label="Height" value={height} onChange={setHeight} min={1} suffix="px" /></div>
            <div className="w-28"><NumberField id="im-p" label="Or scale" value={percent} onChange={setPercent} min={1} max={100} suffix="%" /></div>
            <div className="pb-2"><Toggle label="Keep proportions" checked={maintain} onChange={setMaintain} /></div>
          </>
        ) : null}

        {!fixedFormat ? (
          <div className="w-36">
            <Select id="im-fmt" label="Save as" value={format}
              onChange={(v) => setFormat(v as ImageFormat)}
              options={OUTPUT_FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
          </div>
        ) : null}

        {supportsQuality(fixedFormat ?? format) ? (
          <div className="w-full sm:w-56">
            <Label htmlFor="im-q">Quality — {quality}%</Label>
            <input id="im-q" type="range" min={10} max={100} step={5} value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-[var(--accent)]" />
          </div>
        ) : null}

        <Button onClick={run} disabled={!files.length || busy}>
          {busy ? "Working…" : mode === "compress" ? "Compress" : mode === "resize" ? "Resize" : "Convert"}
        </Button>
        {files.length || results.length ? (
          <Button variant="ghost" disabled={busy} onClick={() => {
            results.forEach((r) => URL.revokeObjectURL(r.previewUrl));
            setFiles([]); setResults([]); setErrors([]);
          }}>Clear</Button>
        ) : null}
      </div>

      {errors.map((e) => <ErrorNote key={e}>{e}</ErrorNote>)}

      {results.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-[13.5px]">
            <span>
              {formatBytes(totalIn)} → <strong>{formatBytes(totalOut)}</strong>
            </span>
            <span className={saved >= 0 ? "text-[var(--good)]" : "text-[var(--warn)]"}>
              {saved >= 0 ? `${saved.toFixed(0)}% smaller` : `${Math.abs(saved).toFixed(0)}% larger`}
            </span>
            {results.length > 1 ? (
              <Button variant="ghost" className="ml-auto"
                onClick={() => results.forEach((r) => downloadBlob(r.blob, r.outName))}>
                Download all
              </Button>
            ) : null}
          </div>

          <Panel>
            <ul>
              {results.map((r) => (
                <FileRow key={r.id} name={r.outName}
                  detail={`${r.width}×${r.height} · ${formatBytes(r.originalSize)} → ${formatBytes(r.newSize)}`}
                  actions={
                    <Button variant="ghost" onClick={() => {
                      downloadBlob(r.blob, r.outName);
                      track("download_completed", { tool: mode });
                    }}>Download</Button>
                  } />
              ))}
            </ul>
          </Panel>
        </>
      ) : null}

      {!files.length && !results.length ? (
        <EmptyNote>
          Your images are processed on this device using your browser&apos;s own
          graphics engine. Nothing is uploaded.
        </EmptyNote>
      ) : null}
    </div>
  );
}
