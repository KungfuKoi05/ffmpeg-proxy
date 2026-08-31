import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CompatibilityBadge } from "@/components/ui/signal";
import { Button } from "@/components/ui/button";
import { formatLength, formatMass, formatMoney } from "@/lib/units";
import { platformName } from "@/lib/catalog/vocabulary";
import { formatRelative } from "@/lib/utils";
import type { BuildSummary } from "@/lib/build/summary";

export interface BuildCardData {
  id: string;
  name: string;
  description: string | null;
  platform: string | null;
  isArchived: boolean;
  updatedAt: string;
  summary: BuildSummary;
}

export function BuildCard({ build }: { build: BuildCardData }) {
  const { summary } = build;
  return (
    <Card className="transition-colors hover:border-line-strong">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/studio/${build.id}`}>
              <h3 className="truncate text-sm font-medium text-ink hover:text-accent">
                {build.name}
              </h3>
            </Link>
            <p className="mt-0.5 text-xs text-ink-muted">
              {platformName(build.platform)} · {summary.componentCount} components · updated{" "}
              {formatRelative(build.updatedAt)}
            </p>
          </div>
          <CompatibilityBadge state={summary.compatibility.overall} />
        </div>

        {build.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-ink-muted">{build.description}</p>
        ) : null}

        <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 font-mono text-[10px]">
          <Metric
            label="Cost"
            value={
              summary.cost.totalCurrentCents === null
                ? "—"
                : formatMoney(summary.cost.totalCurrentCents, summary.currency, { showCents: false })
            }
          />
          <Metric
            label="Weight"
            value={summary.weight.totalGrams === null ? "—" : formatMass(summary.weight.totalGrams)}
          />
          <Metric
            label="Length"
            value={
              summary.dimensions.overallLengthMm === null
                ? "—"
                : formatLength(summary.dimensions.overallLengthMm)
            }
          />
          <Metric
            label="Confidence"
            value={summary.score.overall === null ? "—" : `${summary.score.overall}`}
          />
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/studio/${build.id}`}>
            <Button size="sm" variant="secondary">
              Open
            </Button>
          </Link>
          <Link href={`/builds/${build.id}/shopping-list`}>
            <Button size="sm" variant="ghost">
              Shopping list
            </Button>
          </Link>
          <Link href={`/builds/${build.id}/sheet`}>
            <Button size="sm" variant="ghost">
              Build sheet
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-ink-muted">{value}</dd>
    </div>
  );
}
