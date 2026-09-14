/**
 * Rasterisation logic for PDF compression and PDF -> JPG.
 *
 * Measured behaviour that drives every decision here (see docs/DECISIONS.md):
 *
 *   4.4 MB scan, 4 pages of 300dpi images
 *     structural re-save ......   0.0% smaller  (useless)
 *     raster @2.0x q0.75 ......  86.5% smaller
 *     raster @1.5x q0.70 ......  90.2% smaller
 *     raster @1.0x q0.60 ......  94.1% smaller
 *
 *   4 KB vector-text PDF, 6 pages
 *     structural re-save ......   4.5% smaller
 *     raster @1.5x q0.70 ...... 22,527% LARGER
 *
 * So rasterising is the only thing that meaningfully compresses a scan, and it
 * is ruinous on a text document. The tool must therefore (a) warn before, and
 * (b) refuse to hand back a result that is bigger than the input.
 */

export type CompressLevel = "light" | "balanced" | "strong";

export interface CompressPreset {
  level: CompressLevel;
  label: string;
  /** Render scale relative to the PDF's own point size (1.0 == 72dpi). */
  scale: number;
  /** JPEG quality passed to canvas.toBlob. */
  quality: number;
  /** Typical result on a 300dpi scan, from the measurements above. */
  expectation: string;
}

export const COMPRESS_PRESETS: Record<CompressLevel, CompressPreset> = {
  light: {
    level: "light", label: "Best quality", scale: 2.0, quality: 0.75,
    expectation: "around 85% smaller on a scan, still sharp on screen",
  },
  balanced: {
    level: "balanced", label: "Balanced", scale: 1.5, quality: 0.7,
    expectation: "around 90% smaller, fine for reading and email",
  },
  strong: {
    level: "strong", label: "Smallest file", scale: 1.0, quality: 0.6,
    expectation: "around 94% smaller, noticeably softer text",
  },
};

/**
 * Judges whether rasterising is likely to help, from the amount of real text
 * pdf.js finds. A page of a scan yields almost no text items; a page of a
 * born-digital document yields hundreds.
 */
export type DocumentKind = "scan" | "text" | "mixed";

export interface Assessment {
  kind: DocumentKind;
  textItemsPerPage: number;
  /** Shown before the user commits. Null when there is nothing to warn about. */
  warning: string | null;
}

const TEXT_HEAVY_ITEMS_PER_PAGE = 40;
const SOME_TEXT_ITEMS_PER_PAGE = 5;

export function assessDocument(totalTextItems: number, pageCount: number): Assessment {
  const perPage = pageCount > 0 ? totalTextItems / pageCount : 0;

  if (perPage >= TEXT_HEAVY_ITEMS_PER_PAGE) {
    return {
      kind: "text",
      textItemsPerPage: perPage,
      warning:
        "This PDF contains real text, not scanned images. Compressing it turns every page into a picture — the text stops being selectable or searchable, and the file will usually get LARGER, not smaller. This tool is meant for scans.",
    };
  }
  if (perPage >= SOME_TEXT_ITEMS_PER_PAGE) {
    return {
      kind: "mixed",
      textItemsPerPage: perPage,
      warning:
        "This PDF has some real text. Compressing turns it into images, so that text will no longer be selectable or searchable. Check the result before using it.",
    };
  }
  return {
    kind: "scan",
    textItemsPerPage: perPage,
    warning: null,
  };
}

export type Verdict =
  | { kind: "smaller"; savedPercent: number }
  | { kind: "marginal"; savedPercent: number }
  | { kind: "larger"; grewPercent: number };

/** Below this, compressing is not worth the quality loss. */
const MARGINAL_THRESHOLD_PERCENT = 5;

/**
 * The guard that stops us handing someone a "compressed" file that is bigger
 * than what they gave us. Competitors do this silently; we refuse.
 */
export function judgeResult(originalBytes: number, newBytes: number): Verdict {
  if (originalBytes <= 0) return { kind: "larger", grewPercent: 0 };

  if (newBytes >= originalBytes) {
    return { kind: "larger", grewPercent: ((newBytes - originalBytes) / originalBytes) * 100 };
  }
  const saved = ((originalBytes - newBytes) / originalBytes) * 100;
  return saved < MARGINAL_THRESHOLD_PERCENT
    ? { kind: "marginal", savedPercent: saved }
    : { kind: "smaller", savedPercent: saved };
}

/* --------------------------------------------------------- pdf -> jpg ---- */

export type RenderQuality = "screen" | "print";

export interface RenderPreset {
  value: RenderQuality;
  label: string;
  scale: number;
  quality: number;
  hint: string;
}

export const RENDER_PRESETS: RenderPreset[] = [
  { value: "screen", label: "Screen (150 dpi)", scale: 2, quality: 0.85, hint: "Good for viewing and sharing" },
  { value: "print", label: "Print (300 dpi)", scale: 4, quality: 0.92, hint: "Larger files, sharper detail" },
];

export function renderPreset(value: RenderQuality): RenderPreset {
  return RENDER_PRESETS.find((p) => p.value === value) ?? RENDER_PRESETS[0];
}

/** Zero-padded so a folder of exported pages sorts correctly. */
export function pageImageName(original: string, page: number, total: number, ext = "jpg"): string {
  const stem = original.replace(/\.[^./\\]+$/, "") || "page";
  const width = String(total).length;
  return `${stem}-page-${String(page).padStart(width, "0")}.${ext}`;
}

/** Guards against a huge page count silently locking up the tab. */
export const MAX_RENDER_PAGES = 200;

export function pagesWithinLimit(pageCount: number): { ok: boolean; error?: string } {
  if (pageCount <= 0) return { ok: false, error: "That PDF has no pages." };
  if (pageCount > MAX_RENDER_PAGES) {
    return { ok: false, error: `That PDF has ${pageCount} pages — this tool handles up to ${MAX_RENDER_PAGES}. Split it first.` };
  }
  return { ok: true };
}
