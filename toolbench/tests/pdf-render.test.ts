import { describe, expect, it } from "vitest";
import {
  COMPRESS_PRESETS, assessDocument, judgeResult, renderPreset,
  pageImageName, pagesWithinLimit, MAX_RENDER_PAGES,
} from "@/lib/tools/pdf-render";

describe("assessDocument", () => {
  it("calls a page with almost no text a scan", () => {
    const a = assessDocument(4, 4);
    expect(a.kind).toBe("scan");
    expect(a.warning).toBeNull();
  });

  it("warns loudly on a text-heavy document", () => {
    // This is the case that inflated 4 KB to 910 KB in measurement.
    const a = assessDocument(600, 6);
    expect(a.kind).toBe("text");
    expect(a.warning).toMatch(/LARGER/);
    expect(a.warning).toMatch(/selectable/);
  });

  it("warns more mildly on a mixed document", () => {
    const a = assessDocument(60, 4);
    expect(a.kind).toBe("mixed");
    expect(a.warning).toMatch(/selectable/);
    expect(a.warning).not.toMatch(/LARGER/);
  });

  it("does not divide by zero on an empty document", () => {
    expect(assessDocument(0, 0).textItemsPerPage).toBe(0);
  });
});

describe("judgeResult", () => {
  it("reports a real saving", () => {
    // 4.4 MB scan -> 430 KB, the measured balanced result.
    const v = judgeResult(4_411_610, 430_444);
    expect(v.kind).toBe("smaller");
    expect((v as { savedPercent: number }).savedPercent).toBeCloseTo(90.2, 0);
  });

  it("refuses a result that grew", () => {
    // The text-PDF case: 4 KB in, 910 KB out.
    const v = judgeResult(4_025, 910_766);
    expect(v.kind).toBe("larger");
    expect((v as { grewPercent: number }).grewPercent).toBeGreaterThan(1000);
  });

  it("treats an identical size as larger, not as a win", () => {
    expect(judgeResult(1000, 1000).kind).toBe("larger");
  });

  it("flags a marginal saving rather than calling it a success", () => {
    const v = judgeResult(1000, 970);
    expect(v.kind).toBe("marginal");
    expect((v as { savedPercent: number }).savedPercent).toBeCloseTo(3, 5);
  });

  it("treats 5% as a real saving", () => {
    expect(judgeResult(1000, 949).kind).toBe("smaller");
  });

  it("handles a zero-byte original without dividing by zero", () => {
    expect(judgeResult(0, 100).kind).toBe("larger");
  });
});

describe("presets", () => {
  it("orders compression presets from best quality to smallest file", () => {
    expect(COMPRESS_PRESETS.light.scale).toBeGreaterThan(COMPRESS_PRESETS.balanced.scale);
    expect(COMPRESS_PRESETS.balanced.scale).toBeGreaterThan(COMPRESS_PRESETS.strong.scale);
    expect(COMPRESS_PRESETS.light.quality).toBeGreaterThan(COMPRESS_PRESETS.strong.quality);
  });

  it("states an expectation for every level", () => {
    for (const p of Object.values(COMPRESS_PRESETS)) {
      expect(p.expectation.length).toBeGreaterThan(15);
    }
  });

  it("renders print at a higher scale than screen", () => {
    expect(renderPreset("print").scale).toBeGreaterThan(renderPreset("screen").scale);
  });

  it("falls back to screen for an unknown preset", () => {
    expect(renderPreset("nonsense" as never).value).toBe("screen");
  });
});

describe("pageImageName", () => {
  it("zero-pads so files sort correctly", () => {
    expect(pageImageName("report.pdf", 7, 120)).toBe("report-page-007.jpg");
    expect(pageImageName("report.pdf", 7, 9)).toBe("report-page-7.jpg");
  });

  it("never produces a nameless file", () => {
    expect(pageImageName(".pdf", 1, 1)).toBe("page-page-1.jpg");
  });

  it("respects a different extension", () => {
    expect(pageImageName("a.pdf", 1, 1, "png")).toBe("a-page-1.png");
  });
});

describe("pagesWithinLimit", () => {
  it("accepts a normal document", () => {
    expect(pagesWithinLimit(10).ok).toBe(true);
  });

  it("rejects an empty one", () => {
    expect(pagesWithinLimit(0).ok).toBe(false);
  });

  it("rejects one past the limit and suggests splitting", () => {
    const r = pagesWithinLimit(MAX_RENDER_PAGES + 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Split it first/);
  });
});
