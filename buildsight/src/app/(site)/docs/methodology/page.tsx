import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-ink-muted">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Methodology</h1>
        <p className="mt-2 max-w-2xl">
          Every number in BuildSight is derived from a stored, sourced field. Nothing is estimated
          to fill a gap; a missing value is reported as &ldquo;Not provided by manufacturer.&rdquo;
        </p>
      </header>

      <Section title="Compatibility engine">
        <p>
          Compatibility is decided by explicit rules stored in the database. A rule names the two
          categories (or the two specific products) it applies to, the field it compares, the result
          it produces and the explanation shown to you. There is no inference step and no model in
          this path.
        </p>
        <ul className="mt-3 space-y-1.5">
          <li>
            <Badge tone="green">Compatible</Badge> — a rule matched and both products publish the
            same documented interface.
          </li>
          <li>
            <Badge tone="red">Incompatible</Badge> — a rule matched and the published values differ,
            or a dimensional constraint fails.
          </li>
          <li>
            <Badge tone="yellow">Conditional</Badge> — a rule matched but carries a documented
            condition, shown alongside the result.
          </li>
          <li>
            <Badge tone="gray">Unknown</Badge> — no rule covers the connection, or a product does
            not publish the field the rule compares. Unknown never counts as compatible, and a
            configuration containing an unknown connection is never reported as fully compatible.
          </li>
        </ul>
        <p className="mt-3">
          Each result also carries a confidence level: the weakest verification level among the rule
          and the two products it compared.
        </p>
      </Section>

      <Section title="Dimensional clearance">
        <p>
          The clearance engine lays components out along the assembly axis using published lengths,
          then checks the pairs that share axial space. Radial clearance is
          <code className="mx-1 rounded bg-elevated px-1 py-0.5 font-mono text-[11px] text-ink">
            (host inner bore − guest outer diameter) / 2
          </code>
          ; a negative result is a documented conflict, and anything under 1.5 mm is flagged as
          tight rather than clear. Axial checks compare the handguard&rsquo;s forward edge against
          the muzzle.
        </p>
        <p className="mt-3">
          Overall length is the sum of published component lengths along the axis. Threaded and
          clamped interfaces overlap in reality, so treat it as an upper bound unless a manufacturer
          publishes an installed length. If any component on the axis has no published length, the
          overall length is withheld rather than estimated.
        </p>
      </Section>

      <Section title="Cost">
        <p>
          Estimated build cost sums the best currently observed retail price per component, falling
          back to MSRP where no retail observation exists. Components with neither are counted and
          reported as a gap. Price history is a series of dated observations; the &ldquo;below the
          90-day average&rdquo; figure compares the latest observation with the mean of that window.
        </p>
      </Section>

      <Section title="Weight">
        <p>
          Estimated unloaded weight sums published component weights. It is not a claim about an
          assembled firearm: fasteners, pins, springs and finishes are not in the catalog, and any
          component without a published weight is excluded and counted separately.
        </p>
      </Section>

      <Section title="Build confidence score">
        <p>
          The score measures data and fitment confidence. It deliberately does not rate performance,
          effectiveness or suitability for any purpose. Six weighted dimensions contribute:
          compatibility (30), documentation (25), dimensions (20), availability (10), cost (10) and
          weight balance (5). A dimension with insufficient data is excluded from the average rather
          than guessed at, and the excluded dimensions are shown as &ldquo;n/a&rdquo;.
        </p>
      </Section>

      <Section title="Visual approximation">
        <p>
          Where a manufacturer CAD asset is unavailable, the viewer draws a simplified primitive
          sized from published dimensions. These are labelled VISUAL APPROXIMATION throughout, and a
          part whose length is unpublished is drawn with a dashed outline. The geometry is for
          visualization and fitment context; it is not an engineering model, and BuildSight does not
          produce machining or CAD output.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-xs leading-relaxed">{children}</div>
      </CardContent>
    </Card>
  );
}
