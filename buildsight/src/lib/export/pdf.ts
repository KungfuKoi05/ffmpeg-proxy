/**
 * Minimal PDF writer.
 *
 * Build sheets are text and rules on a page, so this emits PDF 1.4 directly
 * using the standard Helvetica faces rather than pulling in a rendering
 * dependency (pdfkit/puppeteer) and a headless browser into the deploy.
 * Everything needed for the build sheet is here: pages, text with wrapping,
 * lines, filled rectangles and a fixed-pitch table helper.
 */

export type PdfFont = "Helvetica" | "Helvetica-Bold" | "Courier";

export interface PdfTextOptions {
  size?: number;
  font?: PdfFont;
  color?: [number, number, number];
  /** Wrap to this width in points; the call returns the height consumed. */
  maxWidth?: number;
  lineHeight?: number;
}

const FONT_RESOURCE: Record<PdfFont, string> = {
  Helvetica: "F1",
  "Helvetica-Bold": "F2",
  Courier: "F3",
};

/** Average glyph widths as a fraction of font size — good enough for layout. */
const AVERAGE_WIDTH: Record<PdfFont, number> = {
  Helvetica: 0.5,
  "Helvetica-Bold": 0.53,
  Courier: 0.6,
};

export const PAGE_WIDTH = 595.28; // A4 portrait, points
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 48;

export class PdfDocument {
  private pages: string[] = [];
  private current: string[] = [];
  /** Distance from the top of the page to the next baseline. */
  private cursor = MARGIN;

  constructor(private readonly title = "BuildSight build sheet") {
    this.pages = [];
  }

  get y(): number {
    return this.cursor;
  }

  set y(value: number) {
    this.cursor = value;
  }

  get contentWidth(): number {
    return PAGE_WIDTH - MARGIN * 2;
  }

  addPage(): void {
    if (this.current.length > 0) this.pages.push(this.current.join("\n"));
    this.current = [];
    this.cursor = MARGIN;
  }

  /** Start a new page when less than `needed` points remain. */
  ensureSpace(needed: number): void {
    if (this.cursor + needed > PAGE_HEIGHT - MARGIN) this.addPage();
  }

  text(x: number, text: string, options: PdfTextOptions = {}): number {
    const size = options.size ?? 9;
    const font = options.font ?? "Helvetica";
    const lineHeight = options.lineHeight ?? size * 1.35;
    const color = options.color ?? [0.1, 0.1, 0.12];
    const lines = options.maxWidth
      ? wrapText(text, options.maxWidth, size, font)
      : [text];

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      const baseline = PAGE_HEIGHT - this.cursor - size;
      this.current.push(
        `BT /${FONT_RESOURCE[font]} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg ${x} ${baseline.toFixed(
          2,
        )} Td (${escapeText(line)}) Tj ET`,
      );
      this.cursor += lineHeight;
    }
    return lines.length * lineHeight;
  }

  /** Draw text at an explicit x without advancing the shared cursor. */
  textAt(x: number, yFromTop: number, text: string, options: PdfTextOptions = {}): void {
    const size = options.size ?? 9;
    const font = options.font ?? "Helvetica";
    const color = options.color ?? [0.1, 0.1, 0.12];
    const baseline = PAGE_HEIGHT - yFromTop - size;
    this.current.push(
      `BT /${FONT_RESOURCE[font]} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg ${x} ${baseline.toFixed(
        2,
      )} Td (${escapeText(text)}) Tj ET`,
    );
  }

  rule(options: { color?: [number, number, number]; spacing?: number } = {}): void {
    const color = options.color ?? [0.8, 0.8, 0.83];
    const spacing = options.spacing ?? 6;
    this.cursor += spacing;
    this.ensureSpace(2);
    const y = PAGE_HEIGHT - this.cursor;
    this.current.push(
      `${color[0]} ${color[1]} ${color[2]} RG 0.6 w ${MARGIN} ${y.toFixed(2)} m ${(
        PAGE_WIDTH - MARGIN
      ).toFixed(2)} ${y.toFixed(2)} l S`,
    );
    this.cursor += spacing;
  }

  rect(
    x: number,
    yFromTop: number,
    width: number,
    height: number,
    color: [number, number, number],
  ): void {
    const y = PAGE_HEIGHT - yFromTop - height;
    this.current.push(
      `${color[0]} ${color[1]} ${color[2]} rg ${x} ${y.toFixed(2)} ${width} ${height} re f`,
    );
  }

  /** Render one table row across fixed column offsets. */
  row(
    columns: Array<{ x: number; text: string; width?: number; font?: PdfFont; size?: number }>,
    options: { size?: number; lineHeight?: number } = {},
  ): void {
    const size = options.size ?? 8.5;
    const lineHeight = options.lineHeight ?? size * 1.5;
    this.ensureSpace(lineHeight);
    const top = this.cursor;
    for (const column of columns) {
      const text = column.width
        ? truncate(column.text, column.width, column.size ?? size, column.font ?? "Helvetica")
        : column.text;
      this.textAt(column.x, top, text, { size: column.size ?? size, font: column.font });
    }
    this.cursor += lineHeight;
  }

  toBuffer(): Uint8Array {
    if (this.current.length > 0) {
      this.pages.push(this.current.join("\n"));
      this.current = [];
    }
    if (this.pages.length === 0) this.pages.push("");

    const objects: string[] = [];
    const pageCount = this.pages.length;
    // Object ids: 1 catalog, 2 pages, 3..(2+n) pages, then contents, then fonts.
    const pageIds = this.pages.map((_, index) => 3 + index);
    const contentIds = this.pages.map((_, index) => 3 + pageCount + index);
    const fontBase = 3 + pageCount * 2;

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    );
    for (const [index, pageId] of pageIds.entries()) {
      void pageId;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R /F3 ${fontBase + 2} 0 R >> >> ` +
          `/Contents ${contentIds[index]} 0 R >>`,
      );
    }
    for (const content of this.pages) {
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    }
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);
    objects.push(
      `<< /Title (${escapeText(this.title)}) /Producer (BuildSight) /Creator (BuildSight) >>`,
    );
    const infoId = objects.length;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (const [index, body] of objects.entries()) {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
      pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return new TextEncoder().encode(pdf);
  }
}

function escapeText(value: string): string {
  return sanitize(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Standard PDF fonts are single-byte, so fold typography to WinAnsi-safe text. */
function sanitize(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, "");
}

export function textWidth(text: string, size: number, font: PdfFont = "Helvetica"): number {
  return sanitize(text).length * size * AVERAGE_WIDTH[font];
}

export function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: PdfFont = "Helvetica",
): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, font) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function truncate(
  text: string,
  maxWidth: number,
  size: number,
  font: PdfFont = "Helvetica",
): string {
  const clean = sanitize(text);
  if (textWidth(clean, size, font) <= maxWidth) return clean;
  const maxChars = Math.max(1, Math.floor(maxWidth / (size * AVERAGE_WIDTH[font])) - 1);
  return `${clean.slice(0, maxChars)}…`.replace(/…/, "...");
}
