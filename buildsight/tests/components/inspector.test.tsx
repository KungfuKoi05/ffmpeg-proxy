/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inspector } from "@/components/studio/inspector";
import { summarizeBuild } from "@/lib/build/summary";
import { component, product, rule, sampleAssembly } from "../fixtures";

function setup(componentsOverride?: Parameters<typeof summarizeBuild>[0]["components"]) {
  const { upper, barrel, handguard } = sampleAssembly();
  const components =
    componentsOverride ??
    [
      component("upper-receiver", upper),
      component("barrel", barrel),
      component("handguard", handguard),
    ];
  const summary = summarizeBuild({ platform: "ar15", components }, [
    rule({
      id: "barrel-upper",
      subjectCategorySlug: "barrel",
      targetCategorySlug: "upper-receiver",
      subjectField: "barrelCompatibility",
      targetField: "barrelCompatibility",
      explanation: "Compatible — the barrel extension pattern matches.",
    }),
  ]);

  render(
    <Inspector
      summary={summary}
      components={components}
      selectedProductId={null}
      onSelect={vi.fn()}
      onRemove={vi.fn()}
      busyProductId={null}
    />,
  );
  return summary;
}

describe("Inspector", () => {
  it("shows the documented explanation next to each finding", () => {
    setup();
    expect(
      screen.getByText("Compatible — the barrel extension pattern matches."),
    ).toBeInTheDocument();
  });

  it("explains an unknown connection rather than implying compatibility", () => {
    setup();
    const unknowns = screen.getAllByText(/no documented compatibility rule covers/i);
    expect(unknowns.length).toBeGreaterThan(0);
  });

  it("lists the core categories the configuration still needs", () => {
    setup();
    expect(screen.getByText(/Configuration is incomplete/)).toBeInTheDocument();
  });

  it("keeps dimensional clearance separate from functional compatibility", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    expect(
      screen.getByText(/Dimensional clearance is not functional compatibility/i),
    ).toBeInTheDocument();
  });

  it("reports an overall length with its derivation note", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    expect(screen.getByText("23.68 in")).toBeInTheDocument();
    expect(screen.getByText(/upper bound/)).toBeInTheDocument();
  });

  it("withholds an overall length when a length is unpublished", async () => {
    const { upper } = sampleAssembly();
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: null });
    setup([component("upper-receiver", upper), component("barrel", barrel)]);
    await userEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("describes the score as data confidence, not performance", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(
      screen.getByText(/data and fitment confidence only — never performance/i),
    ).toBeInTheDocument();
  });
});
