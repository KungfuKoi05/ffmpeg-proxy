"use client";

import Link from "next/link";
import { Download, Save, Copy, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompatibilityBadge } from "@/components/ui/signal";
import { formatLength, formatMass, formatMoney } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { BuildSummary } from "@/lib/build/summary";

/** Bottom strip: the numbers that change on every component swap. */
export function SummaryBar({
  summary,
  buildId,
  canSave,
  saving,
  dirty,
  onSave,
  onDuplicate,
  className,
}: {
  summary: BuildSummary;
  buildId: string | null;
  canSave: boolean;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
  onDuplicate: () => void;
  className?: string;
}) {
  const cost = summary.cost.totalCurrentCents;
  const msrp = summary.cost.totalMsrpCents;
  const savings = summary.cost.savingsCents;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line bg-surface px-4 py-2.5",
        className,
      )}
    >
      <Metric
        testId="metric-cost"
        label="Estimated cost"
        value={cost === null ? "No pricing" : formatMoney(cost, summary.currency, { showCents: false })}
        hint={
          msrp !== null && savings !== null && savings > 0
            ? `${formatMoney(savings, summary.currency, { showCents: false })} below MSRP`
            : summary.cost.unpricedCount > 0
              ? `${summary.cost.unpricedCount} component(s) without observed pricing`
              : undefined
        }
      />
      <Metric
        testId="metric-weight"
        label="Unloaded weight"
        value={summary.weight.totalGrams === null ? "—" : formatMass(summary.weight.totalGrams)}
        hint={
          summary.weight.missingCount > 0
            ? `${summary.weight.missingCount} component(s) publish no weight`
            : undefined
        }
      />
      <Metric
        testId="metric-length"
        label="Overall length"
        value={
          summary.dimensions.overallLengthMm === null
            ? "—"
            : formatLength(summary.dimensions.overallLengthMm)
        }
        hint={summary.dimensions.overallLengthMm === null ? "A component on the axis has no published length" : undefined}
      />
      <Metric
        testId="metric-components"
        label="Components"
        value={String(summary.componentCount)}
      />
      <Metric
        testId="metric-confidence"
        label="Confidence"
        value={summary.score.overall === null ? "—" : `${summary.score.overall}/100`}
      />

      <div className="flex items-center gap-2">
        <span className="label-micro">Status</span>
        <CompatibilityBadge state={summary.compatibility.overall} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {buildId ? (
          <>
            <Link href={`/builds/${buildId}/shopping-list`}>
              <Button size="sm" variant="ghost">
                <ListChecks /> Shopping list
              </Button>
            </Link>
            <Link href={`/api/builds/${buildId}/export?format=csv`} prefetch={false}>
              <Button size="sm" variant="ghost">
                <Download /> CSV
              </Button>
            </Link>
            <Link href={`/builds/${buildId}/sheet`}>
              <Button size="sm" variant="ghost">
                Build sheet
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={onDuplicate}>
              <Copy /> Duplicate
            </Button>
          </>
        ) : null}
        {canSave ? (
          <Button size="sm" variant="primary" onClick={onSave} disabled={saving || (!dirty && Boolean(buildId))}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {buildId ? (dirty ? "Save changes" : "Saved") : "Save configuration"}
          </Button>
        ) : (
          <Link href="/sign-up">
            <Button size="sm" variant="primary">
              Sign up to save
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <div title={hint} data-testid={testId}>
      <p className="label-micro">{label}</p>
      <p className="font-mono text-sm text-ink">{value}</p>
      {hint ? <p className="text-[10px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
