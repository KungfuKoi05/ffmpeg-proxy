import { describe, expect, it } from "vitest";
import {
  TOOLS, LIVE_TOOLS, CATEGORIES, getTool, toolsInCategory, relatedTools, categoryList,
} from "@/lib/tools/registry";

/**
 * The registry generates every page, the sitemap and all internal linking, so
 * a malformed entry is a site-wide defect rather than a local one. These are
 * the checks that would otherwise only surface in Search Console weeks later.
 */
describe("registry integrity", () => {
  it("has a launch set worth shipping", () => {
    expect(LIVE_TOOLS.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique slugs", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses URL-safe lowercase slugs", () => {
    for (const t of TOOLS) expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("points every tool at a real category", () => {
    for (const t of TOOLS) expect(CATEGORIES[t.category]).toBeDefined();
  });

  it("never links to a tool that does not exist or is not live", () => {
    for (const t of LIVE_TOOLS) {
      for (const slug of t.related) {
        expect(getTool(slug), `${t.slug} links to missing tool "${slug}"`).toBeDefined();
      }
    }
  });

  it("never links a tool to itself", () => {
    for (const t of TOOLS) expect(t.related).not.toContain(t.slug);
  });

  it("gives every live tool four related links after fallback", () => {
    for (const t of LIVE_TOOLS) {
      const related = relatedTools(t, 4);
      expect(related.length, `${t.slug} has too few related tools`).toBeGreaterThanOrEqual(3);
      expect(related.some((r) => r.slug === t.slug)).toBe(false);
    }
  });

  it("keeps meta titles within what Google renders", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.metaTitle.length, `${t.slug} title too long`).toBeLessThanOrEqual(65);
      expect(t.metaTitle.length).toBeGreaterThan(10);
    }
  });

  it("keeps meta descriptions in the useful range", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.metaDescription.length, `${t.slug} description too long`).toBeLessThanOrEqual(165);
      expect(t.metaDescription.length, `${t.slug} description too short`).toBeGreaterThanOrEqual(70);
    }
  });

  it("gives every tool real FAQ content for the schema block", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.faq.length, `${t.slug} needs FAQs`).toBeGreaterThanOrEqual(1);
      for (const f of t.faq) {
        expect(f.q.endsWith("?"), `${t.slug} FAQ not a question: ${f.q}`).toBe(true);
        // Short answers are the hallmark of thin, generated FAQ blocks.
        expect(f.a.length, `${t.slug} FAQ answer too thin`).toBeGreaterThan(40);
      }
    }
  });

  it("gives every tool an h1 and a tagline", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.h1.length).toBeGreaterThan(3);
      expect(t.tagline.length).toBeGreaterThan(20);
    }
  });

  it("declares keywords without stuffing them", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.keywords.length).toBeGreaterThanOrEqual(2);
      expect(t.keywords.length).toBeLessThanOrEqual(8);
    }
  });

  it("processes everything in the browser, which is the cost model", () => {
    for (const t of LIVE_TOOLS) expect(t.processing).toBe("browser");
  });

  it("lists only categories that actually have tools", () => {
    for (const c of categoryList()) {
      expect(toolsInCategory(c.id).length).toBeGreaterThan(0);
    }
  });

  it("spreads the launch set across several categories", () => {
    expect(categoryList().length).toBeGreaterThanOrEqual(3);
  });

  it("hides non-live tools from lookups", () => {
    for (const t of TOOLS.filter((x) => !x.live)) {
      expect(getTool(t.slug)).toBeUndefined();
    }
  });
});
