import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Documentation" };

export default function DocsOverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          BuildSight is a configuration, visualization, compatibility, inventory and
          purchasing-planning platform for commercially available components. This section explains
          exactly what the application computes, what it refuses to do, and how confident you should
          be in each number it shows.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <DocCard
          href="/docs/methodology"
          title="Methodology"
          body="How compatibility, dimensional clearance, cost, weight and the build confidence score are computed — and what each deliberately does not mean."
        />
        <DocCard
          href="/docs/verification"
          title="Verification levels"
          body="The five provenance levels attached to every specification, and why only manufacturer-verified data is treated as authoritative."
        />
        <DocCard
          href="/docs/policy"
          title="Product boundary"
          body="What BuildSight supports and the categories it refuses, enforced in code by a deterministic policy layer."
        />
        <DocCard
          href="/docs/api"
          title="API"
          body="The typed REST endpoints behind the catalog, engines, builds and exports."
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">Three things kept separate</h2>
          <dl className="mt-3 space-y-3 text-xs leading-relaxed text-ink-muted">
            <div>
              <dt className="text-ink">Documented compatibility</dt>
              <dd>
                Whether an authored, sourced rule says two components work together. Results are
                COMPATIBLE, INCOMPATIBLE, CONDITIONAL or UNKNOWN — and UNKNOWN is never presented as
                compatible.
              </dd>
            </div>
            <div>
              <dt className="text-ink">Dimensional clearance</dt>
              <dd>
                Whether published dimensions say two parts physically clear one another. Green here
                is not a claim that the combination functions.
              </dd>
            </div>
            <div>
              <dt className="text-ink">Functional compatibility</dt>
              <dd>
                Only ever asserted by an explicit rule sourced to a manufacturer. The application
                never infers it from geometry.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">About the bundled catalog</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            The catalog that ships with this application is synthetic. Manufacturers are labelled
            DEMO MANUFACTURER, products DEMO PRODUCT, and every record is tagged in the interface.
            No real manufacturer specification is reproduced or invented. Real products enter the
            catalog through the admin ingestion workflow, which requires a source URL and human
            approval before anything is published.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DocCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-line-strong">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{body}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
