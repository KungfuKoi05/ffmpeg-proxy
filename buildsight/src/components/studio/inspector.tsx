"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClearanceBadge,
  CompatibilityBadge,
  SignalDot,
  VerificationBadge,
} from "@/components/ui/signal";
import { DataRow, Meter, PanelHeading, Separator } from "@/components/ui/misc";
import { formatLength, formatMass, formatMoney, NOT_PROVIDED } from "@/lib/units";
import { slotLabel } from "@/lib/assembly/slots";
import { categoryName } from "@/lib/catalog/vocabulary";
import { cn } from "@/lib/utils";
import type { BuildSummary } from "@/lib/build/summary";
import type { AssemblyComponent } from "@/lib/types";

type InspectorTab = "compatibility" | "dimensions" | "components" | "score";

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "compatibility", label: "Compatibility" },
  { id: "dimensions", label: "Dimensions" },
  { id: "components", label: "Components" },
  { id: "score", label: "Score" },
];

/**
 * Right panel: the configuration inspector.
 *
 * The three ideas the product keeps apart — documented compatibility,
 * dimensional clearance and functional compatibility — get their own sections
 * and their own language here.
 */
export function Inspector({
  summary,
  components,
  selectedProductId,
  onSelect,
  onRemove,
  busyProductId,
}: {
  summary: BuildSummary;
  components: AssemblyComponent[];
  selectedProductId: string | null;
  onSelect: (productId: string | null) => void;
  onRemove: (productId: string) => void;
  busyProductId: string | null;
}) {
  const [tab, setTab] = useState<InspectorTab>("compatibility");
  const { compatibility, dimensions, score } = summary;

  return (
    <div className="flex h-full flex-col bg-surface">
      <PanelHeading title="Configuration inspector" />
      <div className="flex border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 border-b-2 px-2 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
              tab === item.id
                ? "border-accent text-ink"
                : "border-transparent text-ink-faint hover:text-ink-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "compatibility" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="label-micro">Overall</span>
              <CompatibilityBadge state={compatibility.overall} />
            </div>
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded border border-line bg-line">
              {(["COMPATIBLE", "CONDITIONAL", "UNKNOWN", "INCOMPATIBLE"] as const).map((state) => (
                <div key={state} className="bg-elevated px-2 py-1.5 text-center">
                  <p className="font-mono text-sm text-ink">{compatibility.counts[state]}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                    {state.slice(0, 4)}
                  </p>
                </div>
              ))}
            </div>

            {compatibility.missingCoreCategories.length > 0 ? (
              <p className="rounded border border-signal-gray/40 bg-signal-gray/10 px-2.5 py-2 text-[11px] text-ink-muted">
                Configuration is incomplete. Still missing:{" "}
                {compatibility.missingCoreCategories.map((slug) => categoryName(slug)).join(", ")}.
              </p>
            ) : null}

            {compatibility.findings.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Add two or more connected components to evaluate documented compatibility.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...compatibility.findings]
                  .sort((a, b) => severity(b.state) - severity(a.state))
                  .map((finding) => (
                    <li
                      key={finding.id}
                      className={cn(
                        "rounded border border-line bg-elevated p-2.5 transition-colors",
                        (selectedProductId === finding.subjectProductId ||
                          selectedProductId === finding.targetProductId) &&
                          "border-accent/50",
                      )}
                      onMouseEnter={() => onSelect(finding.subjectProductId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] leading-snug text-ink">
                          {slotLabel(finding.subjectSlot)} → {slotLabel(finding.targetSlot)}
                        </p>
                        <CompatibilityBadge state={finding.state} />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                        {finding.explanation}
                      </p>
                      {finding.condition ? (
                        <p className="mt-1.5 rounded bg-signal-yellow/10 px-2 py-1 text-[11px] text-signal-yellow">
                          Condition: {finding.condition}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {finding.ruleName ? (
                          <Badge tone="neutral" title="The authored rule that produced this result">
                            {finding.ruleName}
                          </Badge>
                        ) : null}
                        <VerificationBadge status={finding.confidence} />
                        {finding.sourceUrl ? (
                          <a
                            href={finding.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                          >
                            Source <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "dimensions" ? (
          <div className="space-y-3">
            <div className="rounded border border-line bg-elevated p-2.5">
              <p className="label-micro">Overall length</p>
              <p className="mt-1 font-mono text-lg text-ink">
                {dimensions.overallLengthMm === null
                  ? "Unavailable"
                  : formatLength(dimensions.overallLengthMm)}
              </p>
              {dimensions.overallLengthMm !== null ? (
                <p className="font-mono text-[11px] text-ink-faint">
                  {formatLength(dimensions.overallLengthMm, "metric")}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                {dimensions.overallLengthNote}
              </p>
            </div>

            <div>
              <p className="label-micro mb-1.5">Clearance checks</p>
              {dimensions.clearances.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No clearance checks apply to this configuration yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dimensions.clearances.map((clearance) => (
                    <li key={clearance.id} className="rounded border border-line bg-elevated p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] leading-snug text-ink">{clearance.label}</p>
                        <ClearanceBadge state={clearance.state} />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                        {clearance.explanation}
                      </p>
                      {clearance.valueMm !== null ? (
                        <p className="mt-1 font-mono text-[10px] text-ink-faint">
                          {clearance.valueMm.toFixed(2)} mm · derived from{" "}
                          {clearance.measuredFrom.join(" and ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="label-micro mb-1.5">Published measurements</p>
              <div className="rounded border border-line bg-elevated px-2.5 py-1">
                {dimensions.measurements.map((measurement) => (
                  <DataRow
                    key={measurement.key}
                    label={measurement.label}
                    hint={measurement.note}
                    value={
                      measurement.valueMm === null ? (
                        <span className="text-ink-faint" title={NOT_PROVIDED}>
                          Not provided
                        </span>
                      ) : (
                        formatLength(measurement.valueMm)
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <p className="rounded border border-line bg-base px-2.5 py-2 text-[11px] leading-relaxed text-ink-muted">
              <AlertTriangle className="mr-1 inline size-3 text-signal-yellow" />
              Dimensional clearance is not functional compatibility. Two parts that physically clear
              one another may still be documented as incompatible.
            </p>
          </div>
        ) : null}

        {tab === "components" ? (
          <div className="space-y-2">
            {components.length === 0 ? (
              <p className="text-xs text-ink-muted">
                No components yet. Add parts from the library on the left.
              </p>
            ) : (
              components.map((component) => (
                <div
                  key={`${component.slotKey}-${component.product.id}`}
                  className={cn(
                    "rounded border border-line bg-elevated p-2.5",
                    selectedProductId === component.product.id && "border-accent/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() =>
                        onSelect(
                          selectedProductId === component.product.id ? null : component.product.id,
                        )
                      }
                    >
                      <p className="label-micro">{slotLabel(component.slotKey)}</p>
                      <p className="truncate text-xs text-ink">{component.product.productName}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {component.product.manufacturerName} ·{" "}
                        {component.product.manufacturerPartNumber}
                      </p>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemove(component.product.id)}
                      disabled={busyProductId === component.product.id}
                      aria-label={`Remove ${component.product.productName}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Link
                      href={`/catalog/${component.product.slug}`}
                      className="text-[10px] text-accent hover:underline"
                    >
                      View product
                    </Link>
                    <span className="font-mono text-[10px] text-ink-faint">
                      {component.product.weightGrams === null
                        ? "— g"
                        : formatMass(component.product.weightGrams)}{" "}
                      ·{" "}
                      {component.product.currentPriceCents === null
                        ? "—"
                        : formatMoney(component.product.currentPriceCents, component.product.currency, {
                            showCents: false,
                          })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "score" ? (
          <div className="space-y-3">
            <div className="rounded border border-line bg-elevated p-3 text-center">
              <p className="label-micro">Build confidence</p>
              <p className="font-mono text-3xl text-ink">
                {score.overall === null ? "—" : score.overall}
                {score.overall === null ? "" : <span className="text-sm text-ink-faint">/100</span>}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Measures data and fitment confidence only — never performance or effectiveness.
              </p>
            </div>
            <div className="space-y-2.5">
              {score.dimensions.map((dimension) => (
                <div key={dimension.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-ink">{dimension.label}</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {dimension.value === null ? "n/a" : `${dimension.value}%`}
                      <span className="ml-1.5 text-ink-faint">w{dimension.weight}</span>
                    </span>
                  </div>
                  <Meter
                    className="mt-1"
                    value={dimension.value ?? 0}
                    tone={
                      dimension.value === null
                        ? "accent"
                        : dimension.value >= 80
                          ? "green"
                          : dimension.value >= 55
                            ? "yellow"
                            : "red"
                    }
                  />
                  <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">{dimension.note}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1">
              <DataRow
                label="Unpriced components"
                value={String(summary.cost.unpricedCount)}
              />
              <DataRow
                label="Components without weight"
                value={String(summary.weight.missingCount)}
              />
              <DataRow
                label="Regulated components"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <SignalDot state={summary.regulatedComponentIds.length ? "YELLOW" : "GREEN"} />
                    {summary.regulatedComponentIds.length}
                  </span>
                }
                hint="Regulated items route to the manufacturer's own purchase process."
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function severity(state: string): number {
  return { INCOMPATIBLE: 4, CONDITIONAL: 3, UNKNOWN: 2, COMPATIBLE: 1 }[state] ?? 0;
}
