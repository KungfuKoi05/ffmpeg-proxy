/**
 * PDF tool logic.
 *
 * pdf-lib does the document work in the component. The page-range parser lives
 * here because it takes freeform user input ("1-3, 5, 9-") and a wrong answer
 * means deleting the wrong pages of someone's document -- the worst failure
 * this site could have.
 */

export interface RangeResult {
  ok: boolean;
  /** 1-indexed page numbers, sorted, deduplicated. */
  pages: number[];
  error?: string;
}

/**
 * Parses "1-3, 5, 8-10" against a document of `totalPages`.
 * Accepts "N-" as "N to the end" and is tolerant of spaces and stray commas.
 */
export function parsePageRanges(input: string, totalPages: number): RangeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, pages: [], error: "Enter the pages you want." };
  if (totalPages <= 0) return { ok: false, pages: [], error: "The document has no pages." };

  const pages = new Set<number>();

  for (const rawPart of trimmed.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    // Open-ended: "5-" means 5 to the last page.
    const openEnded = /^(\d+)\s*-\s*$/.exec(part);
    if (openEnded) {
      const start = Number(openEnded[1]);
      if (start < 1 || start > totalPages) {
        return { ok: false, pages: [], error: `Page ${start} doesn't exist — the document has ${totalPages}.` };
      }
      for (let p = start; p <= totalPages; p++) pages.add(p);
      continue;
    }

    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < 1) return { ok: false, pages: [], error: "Page numbers start at 1." };
      if (start > totalPages || end > totalPages) {
        return { ok: false, pages: [], error: `That range goes past the end — the document has ${totalPages} pages.` };
      }
      // Accept a reversed range rather than rejecting it; the intent is clear.
      const [lo, hi] = start <= end ? [start, end] : [end, start];
      for (let p = lo; p <= hi; p++) pages.add(p);
      continue;
    }

    const single = /^(\d+)$/.exec(part);
    if (single) {
      const page = Number(single[1]);
      if (page < 1) return { ok: false, pages: [], error: "Page numbers start at 1." };
      if (page > totalPages) {
        return { ok: false, pages: [], error: `Page ${page} doesn't exist — the document has ${totalPages}.` };
      }
      pages.add(page);
      continue;
    }

    return { ok: false, pages: [], error: `Couldn't read "${part}". Use pages like 1, 3-5, 8-.` };
  }

  if (!pages.size) return { ok: false, pages: [], error: "That didn't select any pages." };
  return { ok: true, pages: [...pages].sort((a, b) => a - b) };
}

/** The complement of a selection -- what remains after deleting those pages. */
export function invertPages(selected: number[], totalPages: number): number[] {
  const set = new Set(selected);
  const out: number[] = [];
  for (let p = 1; p <= totalPages; p++) if (!set.has(p)) out.push(p);
  return out;
}

/** Groups a sorted page list into ranges for display: [1,2,3,5] -> "1-3, 5". */
export function describePages(pages: number[]): string {
  if (!pages.length) return "none";
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = current;
    }
    prev = current;
  }
  return parts.join(", ");
}

export type Rotation = 0 | 90 | 180 | 270;

/** PDF rotation is modulo 360 and must stay non-negative. */
export function normalizeRotation(current: number, delta: number): Rotation {
  const value = (((current + delta) % 360) + 360) % 360;
  return value as Rotation;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;

export function validatePdfFile(file: { name: string; type: string; size: number }): {
  ok: boolean; error?: string;
} {
  if (file.size === 0) return { ok: false, error: `${file.name} is empty.` };
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: `${file.name} is too large — the limit is 100 MB.` };
  }
  const byType = file.type === "application/pdf";
  const byExt = /\.pdf$/i.test(file.name);
  if (!byType && !byExt) return { ok: false, error: `${file.name} isn't a PDF.` };
  return { ok: true };
}

export function outputPdfName(original: string, suffix: string): string {
  const stem = original.replace(/\.[^./\\]+$/, "") || "document";
  return `${stem}-${suffix}.pdf`;
}
