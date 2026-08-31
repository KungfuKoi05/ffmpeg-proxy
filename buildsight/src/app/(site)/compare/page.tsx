import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listBuilds, summarizeBuildRecord, toAssemblyInput } from "@/server/builds";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompatibilityBadge, VerificationBadge } from "@/components/ui/signal";
import { EmptyState } from "@/components/ui/misc";
import { ComparisonSelector } from "@/components/comparison-selector";
import { BuildOutline } from "@/components/build-outline";
import { formatLength, formatMass, formatMoney } from "@/lib/units";
import { slotLabel, SLOTS } from "@/lib/assembly/slots";
import { platformName } from "@/lib/catalog/vocabulary";
import { entitlements } from "@/lib/plans";
import { placeAssembly } from "@/lib/assembly/geometry";
import { saveComparisonAction } from "@/server/actions/comparisons";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Compare configurations" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ builds?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const plan = entitlements(user.plan);
  const params = await searchParams;
  const requestedIds = (params.builds ?? "").split(",").filter(Boolean);

  const allBuilds = await listBuilds(user.id);
  const selected = allBuilds
    .filter((build) => requestedIds.includes(build.id))
    .slice(0, plan.compareLimit);

  const columns = await Promise.all(
    selected.map(async (build) => ({
      id: build.id,
      name: build.name,
      platform: build.platform,
      summary: await summarizeBuildRecord(build),
      components: toAssemblyInput(build).components,
    })),
  );

  const slotsInUse = SLOTS.filter((slot) =>
    columns.some((column) => column.components.some((c) => c.slotKey === slot.key)),
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compare configurations</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Select up to {plan.compareLimit} configurations
            {plan.compareLimit < 4 ? " on your plan (Pro compares four)" : ""}. Every figure comes
            from the same engines the studio uses.
          </p>
        </div>
        <Link href="/builds">
          <Button size="sm" variant="ghost">
            Manage builds
          </Button>
        </Link>
      </header>

      <div className="mt-6">
        <ComparisonSelector
          builds={allBuilds.map((build) => ({ id: build.id, name: build.name }))}
          selectedIds={selected.map((build) => build.id)}
          limit={plan.compareLimit}
        />
      </div>

      {columns.length < 2 ? (
        <div className="mt-6">
          <EmptyState
            title="Choose at least two configurations"
            description="Pick configurations above to see component-by-component differences, cost, weight, dimensions and documentation confidence side by side."
            action={
              allBuilds.length < 2 ? (
                <Link href="/studio">
                  <Button size="sm" variant="primary">
                    Create another configuration
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {columns.map((column) => (
              <Card key={column.id}>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-medium text-ink">{column.name}</p>
                  <p className="text-xs text-ink-muted">{platformName(column.platform)}</p>
                  <div className="mt-2 h-28 rounded border border-line bg-base p-2">
                    <BuildOutline parts={placeAssembly(column.components)} />
                  </div>
                  <div className="mt-2">
                    <CompatibilityBadge state={column.summary.compatibility.overall} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-panel border border-line">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-elevated">
                <tr>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    Metric
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Estimated cost"
                  values={columns.map((column) =>
                    column.summary.cost.totalCurrentCents === null
                      ? "—"
                      : formatMoney(column.summary.cost.totalCurrentCents, column.summary.currency),
                  )}
                  highlightLowest
                />
                <Row
                  label="Unloaded weight"
                  values={columns.map((column) =>
                    column.summary.weight.totalGrams === null
                      ? "—"
                      : formatMass(column.summary.weight.totalGrams),
                  )}
                />
                <Row
                  label="Overall length"
                  values={columns.map((column) =>
                    column.summary.dimensions.overallLengthMm === null
                      ? "—"
                      : formatLength(column.summary.dimensions.overallLengthMm),
                  )}
                />
                <Row
                  label="Components"
                  values={columns.map((column) => String(column.summary.componentCount))}
                />
                <Row
                  label="Compatibility"
                  values={columns.map(
                    (column) =>
                      `${column.summary.compatibility.counts.COMPATIBLE} ok / ${column.summary.compatibility.counts.CONDITIONAL} cond / ${column.summary.compatibility.counts.UNKNOWN} unk / ${column.summary.compatibility.counts.INCOMPATIBLE} conflict`,
                  )}
                />
                <Row
                  label="Documentation"
                  values={columns.map((column) => {
                    const documentation = column.summary.score.dimensions.find(
                      (dimension) => dimension.key === "documentation",
                    );
                    return documentation?.value === null || documentation === undefined
                      ? "n/a"
                      : `${documentation.value}%`;
                  })}
                />
                <Row
                  label="Availability"
                  values={columns.map((column) => {
                    const availability = column.summary.score.dimensions.find(
                      (dimension) => dimension.key === "availability",
                    );
                    return availability?.value === null || availability === undefined
                      ? "n/a"
                      : `${availability.value}%`;
                  })}
                />
                <Row
                  label="Build confidence"
                  values={columns.map((column) =>
                    column.summary.score.overall === null
                      ? "—"
                      : `${column.summary.score.overall}/100`,
                  )}
                />

                <tr className="bg-elevated">
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                  >
                    Components by slot
                  </td>
                </tr>
                {slotsInUse.map((slot) => (
                  <tr key={slot.key} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink-faint">{slotLabel(slot.key)}</td>
                    {columns.map((column) => {
                      const component = column.components.find((c) => c.slotKey === slot.key);
                      if (!component) {
                        return (
                          <td key={column.id} className="px-3 py-2 text-ink-faint">
                            —
                          </td>
                        );
                      }
                      const price =
                        component.product.currentPriceCents ?? component.product.msrpCents;
                      return (
                        <td key={column.id} className="px-3 py-2">
                          <Link
                            href={`/catalog/${component.product.slug}`}
                            className="text-ink hover:text-accent"
                          >
                            {component.product.productName}
                          </Link>
                          <p className="text-[11px] text-ink-muted">
                            {component.product.manufacturerName}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-ink-faint">
                            {component.product.lengthMm === null
                              ? "—"
                              : formatLength(component.product.lengthMm)}
                            {" · "}
                            {component.product.weightGrams === null
                              ? "—"
                              : formatMass(component.product.weightGrams)}
                            {" · "}
                            {price === null ? "—" : formatMoney(price, "USD", { showCents: false })}
                          </p>
                          <div className="mt-1">
                            <VerificationBadge status={component.product.verificationStatus} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Badge tone="neutral">
              Differences are computed from published specifications only
            </Badge>
            <form action={saveComparisonAction} className="flex items-center gap-2">
              <input
                type="hidden"
                name="buildIds"
                value={columns.map((column) => column.id).join(",")}
              />
              <Input
                name="name"
                placeholder="Name this comparison"
                className="h-8 w-56 text-xs"
                maxLength={80}
                aria-label="Comparison name"
              />
              <Button type="submit" size="sm" variant="secondary">
                Save comparison
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  values,
  highlightLowest,
}: {
  label: string;
  values: string[];
  highlightLowest?: boolean;
}) {
  const numeric = values.map((value) => Number(value.replace(/[^0-9.]/g, "")));
  const lowest = highlightLowest
    ? Math.min(...numeric.filter((value) => Number.isFinite(value) && value > 0))
    : null;

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2 text-ink-faint">{label}</td>
      {values.map((value, index) => (
        <td
          key={index}
          className={
            lowest !== null && numeric[index] === lowest
              ? "px-3 py-2 font-mono text-signal-green"
              : "px-3 py-2 font-mono text-ink"
          }
        >
          {value}
        </td>
      ))}
    </tr>
  );
}
