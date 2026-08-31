import Link from "next/link";
import {
  Boxes,
  Ruler,
  ShieldCheck,
  Scale,
  LineChart,
  ListChecks,
  Layers,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ALLOWED_CAPABILITIES, RESTRICTED_CAPABILITIES } from "@/lib/policy/policy";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { formatMoney } from "@/lib/units";

export default async function LandingPage() {
  const [user, productCount, manufacturerCount, ruleCount] = await Promise.all([
    getCurrentUser(),
    prisma.product.count({ where: { publishState: "PUBLISHED" } }),
    prisma.manufacturer.count(),
    prisma.compatibilityRule.count({ where: { isActive: true } }),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="tech-grid absolute inset-0 opacity-40" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-base/60 to-base"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <Badge tone="accent" className="mb-5">
            Configuration · Visualization · Compatibility
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            A digital garage for component configurations.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted">
            Assemble a virtual configuration from commercially available components, check
            documented compatibility, visualize dimensions and clearances, and see estimated cost
            and unloaded weight update as you swap parts. Every specification carries its source.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={user ? "/studio" : "/sign-up"}>
              <Button variant="primary" size="lg">
                {user ? "Open Build Studio" : "Start building"}
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="outline" size="lg">
                Browse the catalog
              </Button>
            </Link>
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4">
            <Stat label="Products" value={productCount} />
            <Stat label="Manufacturers" value={manufacturerCount} />
            <Stat label="Compatibility rules" value={ruleCount} />
            <Stat label="Inferred specs" value={0} hint="Specifications are never inferred." />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-xl font-semibold tracking-tight">What the platform does</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          A parts database, a configurator, a 3D product visualizer, a compatibility engine and a
          shopping list — held together by one rule: nothing is asserted without a source.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Boxes />}
            title="Build Studio"
            body="A three-panel workstation: component library, interactive assembly, and a configuration inspector that recomputes on every change."
          />
          <Feature
            icon={<ShieldCheck />}
            title="Compatibility engine"
            body="Explicit, human-authored rules — never model guesses. Results are compatible, incompatible, conditional or unknown, each with an explanation."
          />
          <Feature
            icon={<Ruler />}
            title="Dimensional clearance"
            body="Overall length, bore clearances and interference, derived only from published dimensions. Kept strictly separate from functional compatibility."
          />
          <Feature
            icon={<Layers />}
            title="3D and 2D views"
            body="Orbit, exploded, x-ray and measurement modes, plus side, top, front and section technical views with dimension overlays."
          />
          <Feature
            icon={<Scale />}
            title="Cost and weight"
            body="Estimated build cost from observed retail pricing and estimated unloaded component weight, with gaps reported rather than filled in."
          />
          <Feature
            icon={<LineChart />}
            title="Price tracking"
            body="Price history per retailer, 90-day comparisons and watchlist alerts when an observed price moves."
          />
          <Feature
            icon={<ListChecks />}
            title="Shopping lists"
            body="A clean parts list with part numbers and official product pages. Regulated items route to the manufacturer's own purchase process."
          />
          <Feature
            icon={<FileText />}
            title="Exports"
            body="PDF build sheet, CSV parts list, JSON configuration and image renders, each carrying verification status and source links."
          />
          <Feature
            icon={<ShieldCheck />}
            title="SCOPE assistant"
            body="Translates a request into structured database filters. It searches the verified catalog; the rules engine — not the model — decides compatibility."
          />
        </div>
      </section>

      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">The product boundary</h2>
            <p className="mt-2 text-sm text-ink-muted">
              BuildSight is deliberately scoped. The boundary is enforced in code by a policy layer
              applied to every free-text surface, not by prompt instructions.
            </p>
            <Link href="/docs/policy" className="mt-4 inline-block">
              <Button variant="outline" size="sm">
                Read the policy
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="label-micro text-signal-green">Supported</p>
                <ul className="mt-3 space-y-1.5">
                  {ALLOWED_CAPABILITIES.map((item) => (
                    <li key={item} className="text-xs text-ink-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="label-micro text-signal-red">Not supported</p>
                <ul className="mt-3 space-y-1.5">
                  {RESTRICTED_CAPABILITIES.map((item) => (
                    <li key={item} className="text-xs text-ink-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Plans</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Start free. Upgrade when you keep more than a handful of configurations.
            </p>
          </div>
          <Link href="/pricing" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Compare plans
            </Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            return (
              <Card key={plan.id}>
                <CardContent className="flex h-full flex-col p-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-accent">
                    {plan.name}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {plan.priceCents === null
                      ? "Custom"
                      : plan.priceCents === 0
                        ? "Free"
                        : formatMoney(plan.priceCents)}
                    {plan.priceCents ? (
                      <span className="text-xs font-normal text-ink-faint">/mo</span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">{plan.tagline}</p>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {plan.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="text-xs text-ink-muted">
                        · {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-surface px-4 py-3" title={hint}>
      <dt className="label-micro">{label}</dt>
      <dd className="mt-1 font-mono text-xl text-ink">{value.toLocaleString()}</dd>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="transition-colors hover:border-line-strong">
      <CardContent className="p-4">
        <div className="flex size-8 items-center justify-center rounded border border-line bg-elevated text-accent [&_svg]:size-4">
          {icon}
        </div>
        <p className="mt-3 text-sm font-medium">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{body}</p>
      </CardContent>
    </Card>
  );
}
