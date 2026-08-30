import { describe, expect, it } from "vitest";
import {
  parsePageRanges, invertPages, describePages, normalizeRotation,
  validatePdfFile, outputPdfName,
} from "@/lib/tools/pdf";

describe("parsePageRanges", () => {
  it("parses a single page", () => {
    expect(parsePageRanges("3", 10)).toMatchObject({ ok: true, pages: [3] });
  });

  it("parses a range", () => {
    expect(parsePageRanges("2-4", 10).pages).toEqual([2, 3, 4]);
  });

  it("parses a mixed list and tolerates spaces", () => {
    expect(parsePageRanges(" 1-3 , 5 ,8-9 ", 10).pages).toEqual([1, 2, 3, 5, 8, 9]);
  });

  it("treats N- as through to the end", () => {
    expect(parsePageRanges("8-", 10).pages).toEqual([8, 9, 10]);
  });

  it("deduplicates and sorts overlapping input", () => {
    expect(parsePageRanges("5,1-3,2", 10).pages).toEqual([1, 2, 3, 5]);
  });

  it("accepts a reversed range rather than rejecting clear intent", () => {
    expect(parsePageRanges("5-3", 10).pages).toEqual([3, 4, 5]);
  });

  it("ignores stray commas", () => {
    expect(parsePageRanges("1,,3", 10).pages).toEqual([1, 3]);
  });

  // The failure modes below are the ones that would delete the wrong pages.
  it("rejects a page past the end and says how many there are", () => {
    const r = parsePageRanges("11", 10);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/has 10/);
  });

  it("rejects a range past the end", () => {
    expect(parsePageRanges("8-12", 10).ok).toBe(false);
  });

  it("rejects page zero", () => {
    expect(parsePageRanges("0", 10).ok).toBe(false);
    expect(parsePageRanges("0-3", 10).ok).toBe(false);
  });

  it("rejects gibberish with the offending text", () => {
    const r = parsePageRanges("1, abc", 10);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/abc/);
  });

  it("rejects empty input", () => {
    expect(parsePageRanges("   ", 10).ok).toBe(false);
  });

  it("rejects an open range starting past the end", () => {
    expect(parsePageRanges("20-", 10).ok).toBe(false);
  });

  it("handles a document with no pages", () => {
    expect(parsePageRanges("1", 0).ok).toBe(false);
  });
});

describe("invertPages", () => {
  it("returns what is left after removing a selection", () => {
    expect(invertPages([2, 4], 5)).toEqual([1, 3, 5]);
  });

  it("returns everything when nothing is selected", () => {
    expect(invertPages([], 3)).toEqual([1, 2, 3]);
  });

  it("returns nothing when everything is selected", () => {
    expect(invertPages([1, 2, 3], 3)).toEqual([]);
  });
});

describe("describePages", () => {
  it("collapses consecutive runs", () => {
    expect(describePages([1, 2, 3, 5])).toBe("1-3, 5");
  });

  it("handles isolated pages", () => {
    expect(describePages([1, 3, 5])).toBe("1, 3, 5");
  });

  it("handles one page and none", () => {
    expect(describePages([4])).toBe("4");
    expect(describePages([])).toBe("none");
  });

  it("sorts before describing", () => {
    expect(describePages([3, 1, 2])).toBe("1-3");
  });
});

describe("normalizeRotation", () => {
  it("wraps past 360", () => {
    expect(normalizeRotation(270, 90)).toBe(0);
  });

  it("handles negative rotation without going negative", () => {
    expect(normalizeRotation(0, -90)).toBe(270);
  });

  it("adds normally", () => {
    expect(normalizeRotation(90, 90)).toBe(180);
  });
});

describe("validatePdfFile", () => {
  const f = (over: Partial<{ name: string; type: string; size: number }> = {}) =>
    ({ name: "a.pdf", type: "application/pdf", size: 1000, ...over });

  it("accepts a PDF", () => {
    expect(validatePdfFile(f()).ok).toBe(true);
  });

  it("accepts by extension when the type is missing", () => {
    expect(validatePdfFile(f({ type: "" })).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(validatePdfFile(f({ size: 0 })).ok).toBe(false);
  });

  it("rejects a non-PDF", () => {
    expect(validatePdfFile(f({ name: "a.docx", type: "application/msword" })).ok).toBe(false);
  });

  it("rejects an oversized file", () => {
    expect(validatePdfFile(f({ size: 200 * 1024 * 1024 })).ok).toBe(false);
  });
});

describe("outputPdfName", () => {
  it("adds a suffix and keeps the pdf extension", () => {
    expect(outputPdfName("report.pdf", "merged")).toBe("report-merged.pdf");
  });

  it("never produces a nameless file", () => {
    expect(outputPdfName(".pdf", "split")).toBe("document-split.pdf");
  });
});
