import { describe, expect, it } from "vitest";
import {
  computeResizeDimensions, formatBytes, savingsPercent, outputFilename,
  validateImageFile, supportsQuality, mimeFor, extFor, MAX_IMAGE_BYTES,
} from "@/lib/tools/image";

const ORIGINAL = { width: 1600, height: 900 };

describe("computeResizeDimensions", () => {
  it("scales by percentage", () => {
    expect(computeResizeDimensions(ORIGINAL, { percent: 50 })).toEqual({ width: 800, height: 450 });
  });

  it("derives height from width, keeping the ratio", () => {
    expect(computeResizeDimensions(ORIGINAL, { width: 800 })).toEqual({ width: 800, height: 450 });
  });

  it("derives width from height", () => {
    expect(computeResizeDimensions(ORIGINAL, { height: 450 })).toEqual({ width: 800, height: 450 });
  });

  it("fits inside a box rather than distorting to fill it", () => {
    // A 1600x900 image into a 400x400 box fits to 400x225, not 400x400.
    expect(computeResizeDimensions(ORIGINAL, { width: 400, height: 400 }))
      .toEqual({ width: 400, height: 225 });
  });

  it("stretches to exact dimensions when aspect is not maintained", () => {
    expect(computeResizeDimensions(ORIGINAL, { width: 400, height: 400, maintainAspect: false }))
      .toEqual({ width: 400, height: 400 });
  });

  it("refuses to upscale by default", () => {
    expect(computeResizeDimensions({ width: 100, height: 100 }, { width: 500 }))
      .toEqual({ width: 100, height: 100 });
  });

  it("upscales when explicitly allowed", () => {
    expect(computeResizeDimensions({ width: 100, height: 100 }, { width: 500, allowUpscale: true }))
      .toEqual({ width: 500, height: 500 });
  });

  it("never returns a zero or fractional dimension", () => {
    // Canvas throws on a zero dimension, so tiny percentages must clamp to 1.
    const r = computeResizeDimensions(ORIGINAL, { percent: 0.01 });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(r.width)).toBe(true);
    expect(Number.isInteger(r.height)).toBe(true);
  });

  it("returns the original when nothing is specified", () => {
    expect(computeResizeDimensions(ORIGINAL, {})).toEqual(ORIGINAL);
  });

  it("survives a degenerate source", () => {
    expect(computeResizeDimensions({ width: 0, height: 0 }, { width: 100 }))
      .toEqual({ width: 1, height: 1 });
  });

  it("ignores NaN inputs instead of producing NaN output", () => {
    const r = computeResizeDimensions(ORIGINAL, { width: NaN, percent: NaN });
    expect(r).toEqual(ORIGINAL);
  });
});

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("drops the decimal on larger numbers", () => {
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });

  it("handles nonsense without printing NaN", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});

describe("savingsPercent", () => {
  it("reports a reduction", () => {
    expect(savingsPercent(1000, 250)).toBe(75);
  });

  it("goes negative when the output grew, rather than hiding it", () => {
    expect(savingsPercent(100, 150)).toBe(-50);
  });

  it("does not divide by zero", () => {
    expect(savingsPercent(0, 100)).toBe(0);
  });
});

describe("outputFilename", () => {
  it("replaces the extension rather than appending", () => {
    expect(outputFilename("photo.png", "jpeg")).toBe("photo.jpg");
  });

  it("keeps dots inside the name", () => {
    expect(outputFilename("my.holiday.photo.png", "webp")).toBe("my.holiday.photo.webp");
  });

  it("adds a suffix when asked", () => {
    expect(outputFilename("photo.jpg", "jpeg", "-resized")).toBe("photo-resized.jpg");
  });

  it("never produces a nameless file", () => {
    expect(outputFilename(".png", "png")).toBe("image.png");
  });
});

describe("validateImageFile", () => {
  const f = (over: Partial<{ name: string; type: string; size: number }> = {}) =>
    ({ name: "a.jpg", type: "image/jpeg", size: 1000, ...over });

  it("accepts a normal image", () => {
    expect(validateImageFile(f()).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(validateImageFile(f({ size: 0 })).ok).toBe(false);
  });

  it("rejects something oversized and says the limit", () => {
    const r = validateImageFile(f({ size: MAX_IMAGE_BYTES + 1 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/limit/);
  });

  it("rejects a non-image", () => {
    expect(validateImageFile(f({ name: "doc.pdf", type: "application/pdf" })).ok).toBe(false);
  });

  it("falls back to the extension when the browser reports no type", () => {
    expect(validateImageFile(f({ name: "photo.HEIC", type: "" })).ok).toBe(false);
    expect(validateImageFile(f({ name: "photo.webp", type: "" })).ok).toBe(true);
  });
});

describe("format helpers", () => {
  it("knows PNG ignores quality", () => {
    expect(supportsQuality("png")).toBe(false);
    expect(supportsQuality("jpeg")).toBe(true);
    expect(supportsQuality("webp")).toBe(true);
  });

  it("maps formats to mime types and extensions", () => {
    expect(mimeFor("jpeg")).toBe("image/jpeg");
    expect(extFor("jpeg")).toBe("jpg");
    expect(mimeFor("webp")).toBe("image/webp");
  });
});
