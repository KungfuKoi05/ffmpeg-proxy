import { describe, expect, it } from "vitest";
import { LIVE_TOOLS } from "@/lib/tools/registry";
import { TOOL_COMPONENTS } from "@/components/tools";

/**
 * The registry and the component map are two lists that must agree. If they
 * drift, a page either 500s or renders a placeholder to a real visitor -- and
 * that visitor arrived from search, so it is the worst possible first
 * impression. This catches it at build time instead.
 */
describe("registry / component wiring", () => {
  it("has a component for every live tool", () => {
    const missing = LIVE_TOOLS.filter((t) => !TOOL_COMPONENTS[t.slug]).map((t) => t.slug);
    expect(missing, `tools with no component: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no component pointing at a tool that no longer exists", () => {
    const slugs = new Set(LIVE_TOOLS.map((t) => t.slug));
    const orphans = Object.keys(TOOL_COMPONENTS).filter((s) => !slugs.has(s));
    expect(orphans, `components with no registry entry: ${orphans.join(", ")}`).toEqual([]);
  });

  it("maps every slug to something renderable", () => {
    for (const [slug, C] of Object.entries(TOOL_COMPONENTS)) {
      expect(typeof C, `${slug} is not a component`).toBe("function");
    }
  });
});
