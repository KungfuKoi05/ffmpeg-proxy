import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuildForUser, summarizeBuildRecord, toAssemblyInput } from "@/server/builds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompatibilityBadge, ClearanceBadge, VerificationBadge } from "@/components/ui/signal";
import { formatLength, formatMass, formatMoney } from "@/lib/units";
import { platformName, VERIFICATION_LABELS } from "@/lib/catalog/vocabulary";
import { slotLabel } from "@/lib/assembly/slots";
import { formatDate } from "@/lib/utils";
import { entitlements } from "@/lib/plans";

export const metadata: Metadata = { title: "Build sheet" };

/** A printable build sheet. The PDF export renders the same content. */
export default async function BuildSheetPage({
  params,
}: {
  params: Promise<{ buildId: string }>;
}) {
  const user = await getCurrentUser();
  const { buildId } = await params;
  if (!user) redirect(`/sign-in?next=/builds/${buildId}/sheet`);

  let build;
  try {
    build = await getBuildForUser(buildId, user.id);
  } catch {
    notFound();
  }

  const summary = await summarizeBuildRecord(build);
  const components = toAssemblyInput(build).components;
  const warnings = summary.compatibility.findings.filter((f) => f.state !== "COMPATIBLE");
  const clearanceWarnings = summary.dimensions.clearances.filter((c) => c.state !== "GREEN");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio/${build.id}`} className="text-xs text-accent hover:underline">
          ← Back to the studio
        </Link>
        <div className="flex gap-2">
          <a
            href={`/api/builds/${build.id}/export?format=pdf`}
            download
            title={entitlements(user.plan).pdfExport ? undefined : "PDF export is a Pro feature."}
          >
            <Button size="sm" variant="secondary" disabled={!entitlements(user.plan).pdfExport}>
              Download PDF
            </Button>
          </a>
          <a href={`/api/builds/${build.id}/export?format=json`} download>
            <Button size="sm" variant="ghost">
              JSON
            </Button>
          </a>
        </div>
      </div>

      <article className="rounded-panel border border-line bg-surface p-6">
        <header className="border-b border-line pb-4">
          <p className="label-micro">BuildSight build sheet</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{build.name}</h1>
          {build.description ? (
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">{build.description}</p>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <Field label="Platform" value={platformName(build.platform)} />
            <Field label="Caliber" value={build.caliber ?? "Not specified"} />
            <Field label="Components" value={String(summary.componentCount)} />
            <Field label="Updated" value={formatDate(build.updatedAt)} />
          </dl>
        </header>

        <section className="grid gap-4 border-b border-line py-4 sm:grid-cols-4">
          <Metric
            label="Estimated cost"
            value={
              summary.cost.totalCurrentCents === null
                ? "No pricing"
                : formatMoney(summary.cost.totalCurrentCents, summary.currency)
            }
            note={
              summary.cost.unpricedCount > 0
                ? `${summary.cost.unpricedCount} component(s) unpriced`
                : undefined
            }
          />
          <Metric
            label="Unloaded weight"
            value={summary.weight.totalGrams === null ? "—" : formatMass(summary.weight.totalGrams)}
            note={
              summary.weight.missingCount > 0
                ? `${summary.weight.missingCount} without published weight`
                : undefined
            }
          />
          <Metric
            label="Overall length"
            value={
              summary.dimensions.overallLengthMm === null
                ? "Withheld"
                : formatLength(summary.dimensions.overallLengthMm)
            }
          />
          <Metric
            label="Build confidence"
            value={summary.score.overall === null ? "—" : `${summary.score.overall}/100`}
          />
        </section>

        <section className="border-b border-line py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Components</h2>
            <CompatibilityBadge state={summary.compatibility.overall} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink-faint">
                  <th className="py-2 font-mono text-[10px] uppercase tracking-wider">Slot</th>
                  <th className="py-2 font-mono text-[10px] uppercase tracking-wider">Component</th>
                  <th className="py-2 font-mono text-[10px] uppercase tracking-wider">Part no.</th>
                  <th className="py-2 font-mono text-[10px] uppercase tracking-wider">Length</th>
                  <th className="py-2 font-mono text-[10px] uppercase tracking-wider">Weight</th>
                  <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {components.map((component) => {
                  const price =
                    component.product.currentPriceCents ?? component.product.msrpCents;
                  return (
                    <tr key={component.product.id} className="border-b border-line/60 align-top">
                      <td className="py-2 text-ink-faint">{slotLabel(component.slotKey)}</td>
                      <td className="py-2">
                        <Link
                          href={`/catalog/${component.product.slug}`}
                          className="text-ink hover:text-accent"
                        >
                          {component.product.productName}
                        </Link>
                        <p className="text-ink-muted">{component.product.manufacturerName}</p>
                        <p className="mt-1 text-[10px] text-ink-faint">
                          {VERIFICATION_LABELS[component.product.verificationStatus]}
                          {component.product.sourceUrl ? (
                            <>
                              {" · "}
                              <a
                                href={component.product.sourceUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-accent hover:underline"
                              >
                                source
                              </a>
                            </>
                          ) : (
                            " · no source recorded"
                          )}
                        </p>
                      </td>
                      <td className="py-2 font-mono text-ink-muted">
                        {component.product.manufacturerPartNumber}
                      </td>
                      <td className="py-2 font-mono text-ink-muted">
                        {component.product.lengthMm === null
                          ? "—"
                          : formatLength(component.product.lengthMm)}
                      </td>
                      <td className="py-2 font-mono text-ink-muted">
                        {component.product.weightGrams === null
                          ? "—"
                          : formatMass(component.product.weightGrams)}
                      </td>
                      <td className="py-2 text-right font-mono text-ink-muted">
                        {price === null ? "—" : formatMoney(price, component.product.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-b border-line py-4">
          <h2 className="mb-3 text-sm font-semibold">Confidence breakdown</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {summary.score.dimensions.map((dimension) => (
              <div key={dimension.key} className="rounded border border-line bg-elevated p-2.5">
                <div className="flex items-baseline justify-between">
                  <dt className="text-xs text-ink">{dimension.label}</dt>
                  <dd className="font-mono text-xs text-ink-muted">
                    {dimension.value === null ? "n/a" : `${dimension.value}%`}
                  </dd>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">{dimension.note}</p>
              </div>
            ))}
          </dl>
        </section>

        {warnings.length > 0 || clearanceWarnings.length > 0 ? (
          <section className="border-b border-line py-4">
            <h2 className="mb-3 text-sm font-semibold">Warnings</h2>
            <ul className="space-y-2">
              {warnings.map((finding) => (
                <li key={finding.id} className="rounded border border-line bg-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-ink">
                      {finding.subjectLabel} → {finding.targetLabel}
                    </p>
                    <CompatibilityBadge state={finding.state} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{finding.explanation}</p>
                  {finding.condition ? (
                    <p className="mt-1 text-xs text-signal-yellow">
                      Condition: {finding.condition}
                    </p>
                  ) : null}
                  <div className="mt-1.5">
                    <VerificationBadge status={finding.confidence} />
                  </div>
                </li>
              ))}
              {clearanceWarnings.map((clearance) => (
                <li key={clearance.id} className="rounded border border-line bg-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-ink">{clearance.label}</p>
                    <ClearanceBadge state={clearance.state} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{clearance.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="pt-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="yellow">Visual approximation</Badge>
            <Badge tone="neutral">Dimensional clearance ≠ functional compatibility</Badge>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Values shown come from the catalog record and its cited sources. Missing values are
            reported rather than estimated. BuildSight does not provide manufacturing, machining,
            conversion, safety-defeat or ammunition-loading information.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-micro">{label}</dt>
      <dd className="mt-0.5 text-xs text-ink">{value}</dd>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="label-micro">{label}</p>
      <p className="mt-1 font-mono text-lg text-ink">{value}</p>
      {note ? <p className="text-[11px] text-ink-faint">{note}</p> : null}
    </div>
  );
}
