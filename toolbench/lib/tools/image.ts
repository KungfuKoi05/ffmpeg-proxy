/**
 * Image tool logic.
 *
 * The Canvas work happens in the component; everything decidable without a
 * browser lives here so it can be unit-tested. Getting dimension maths or MIME
 * handling wrong produces silently corrupt output, which is exactly the class
 * of bug a user won't report -- they'll just leave.
 */

export type ImageFormat = "jpeg" | "png" | "webp";

export const ACCEPTED_INPUT_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif",
];

/** Browsers reliably encode to these three. */
export const OUTPUT_FORMATS: { value: ImageFormat; label: string; mime: string; ext: string }[] = [
  { value: "jpeg", label: "JPG", mime: "image/jpeg", ext: "jpg" },
  { value: "png", label: "PNG", mime: "image/png", ext: "png" },
  { value: "webp", label: "WebP", mime: "image/webp", ext: "webp" },
];

export function mimeFor(format: ImageFormat): string {
  return OUTPUT_FORMATS.find((f) => f.value === format)!.mime;
}

export function extFor(format: ImageFormat): string {
  return OUTPUT_FORMATS.find((f) => f.value === format)!.ext;
}

/** PNG ignores the quality argument; saying so avoids a misleading control. */
export function supportsQuality(format: ImageFormat): boolean {
  return format !== "png";
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ResizeRequest {
  width?: number | null;
  height?: number | null;
  /** Percentage of the original. Takes precedence when set. */
  percent?: number | null;
  maintainAspect?: boolean;
  /** Never scale a small image up unless explicitly allowed. */
  allowUpscale?: boolean;
}

/**
 * Works out the output size. Always returns whole pixels of at least 1 --
 * a zero dimension makes canvas throw, and a fractional one silently rounds
 * in ways that break aspect ratio across a batch.
 */
export function computeResizeDimensions(
  original: Dimensions,
  req: ResizeRequest,
): Dimensions {
  const { width: ow, height: oh } = original;
  if (ow <= 0 || oh <= 0) return { width: 1, height: 1 };

  const ratio = ow / oh;
  const maintain = req.maintainAspect !== false;
  let w: number;
  let h: number;

  if (req.percent != null && Number.isFinite(req.percent) && req.percent > 0) {
    w = (ow * req.percent) / 100;
    h = (oh * req.percent) / 100;
  } else {
    const hasW = req.width != null && Number.isFinite(req.width) && req.width > 0;
    const hasH = req.height != null && Number.isFinite(req.height) && req.height > 0;

    if (hasW && hasH) {
      w = req.width as number;
      h = req.height as number;
      if (maintain) {
        // Fit inside the box rather than distorting to fill it.
        const scale = Math.min(w / ow, h / oh);
        w = ow * scale;
        h = oh * scale;
      }
    } else if (hasW) {
      w = req.width as number;
      h = maintain ? w / ratio : oh;
    } else if (hasH) {
      h = req.height as number;
      w = maintain ? h * ratio : ow;
    } else {
      w = ow;
      h = oh;
    }
  }

  if (!req.allowUpscale) {
    const scale = Math.min(1, ow / w, oh / h);
    if (scale < 1) { w *= scale; h *= scale; }
  }

  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** Negative when the output grew -- which happens, and should be shown. */
export function savingsPercent(originalBytes: number, newBytes: number): number {
  if (originalBytes <= 0) return 0;
  return ((originalBytes - newBytes) / originalBytes) * 100;
}

/** Replaces the extension rather than appending, and never yields an empty stem. */
export function outputFilename(original: string, format: ImageFormat, suffix = ""): string {
  const stem = original.replace(/\.[^./\\]+$/, "") || "image";
  return `${stem}${suffix}.${extFor(format)}`;
}

export interface FileValidation {
  ok: boolean;
  error?: string;
}

/** 50MB: above this a browser canvas realistically stalls or crashes the tab. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export function validateImageFile(file: { name: string; type: string; size: number }): FileValidation {
  if (file.size === 0) return { ok: false, error: `${file.name} is empty.` };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_IMAGE_BYTES)}.` };
  }
  // Some browsers report an empty type for exotic files; fall back to extension.
  const byType = file.type && file.type.startsWith("image/");
  const byExt = /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name);
  if (!byType && !byExt) {
    return { ok: false, error: `${file.name} doesn't look like an image.` };
  }
  return { ok: true };
}
