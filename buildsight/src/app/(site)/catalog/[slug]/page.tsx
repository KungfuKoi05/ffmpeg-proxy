import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Ruler } from "lucide-react";
import { getProductBySlug, getProductById } from "@/server/products";
import { serializeProduct } from "@/server/serializers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationBadge, CompatibilityBadge, verificationHelp } from "@/components/ui/signal";
import { DataRow, DemoTag, Meter, Separator } from "@/components/ui/misc";
import { PartSilhouette } from "@/components/catalog/part-silhouette";
import { PriceHistory } from "@/components/catalog/price-history";
import { ProductActions } from "@/components/catalog/product-actions";
import { formatLength, formatMass, formatMoney, NOT_PROVIDED } from "@/lib/units";
import { categoryName, interfaceName, platformName } from "@/lib/catalog/vocabulary";
import { qualityBand } from "@/lib/quality/data-quality";
import type { CompatibilityState } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.productName,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = (await getProductBySlug(slug)) ?? (await getProductById(slug));
  if (!record) notFound();

  const product = serializeProduct(record);
  const user = await getCurrentUser();

  const [rules, builds, watchItem] = await Promise.all([
    prisma.compatibilityRule.findMany({
      where: {
        isActive: true,
        OR: [
          { subjectCategorySlug: product.categorySlug },
          { targetCategorySlug: product.categorySlug },
          { subjectProductId: product.id },
          { targetProductId: product.id },
        ],
      },
      orderBy: { priority: "asc" },
    }),
    user
      ? prisma.build.findMany({
          where: { ownerId: user.id, isArchived: false },
          select: { id: true, name: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    user
      ? prisma.watchlistItem.findUnique({
          where: { ownerId_productId: { ownerId: user.id, productId: product.id } },
        })
      : Promise.resolve(null),
  ]);

  if (user) {
    await prisma.recentlyViewedProduct.upsert({
      where: { ownerId_productId: { ownerId: user.id, productId: product.id } },
      create: { ownerId: user.id, productId: product.id },
      update: { viewedAt: new Date() },
    });
  }

  const price = product.currentPriceCents ?? product.msrpCents;
  const quality = qualityBand(product.dataQualityScore ?? 0);

  const interfaces: Array<[string, string | null]> = [
    ["Mounting interface", product.mountingInterface],
    ["Thread specification", product.threadSpecification],
    ["Gas system", product.gasSystemCompatibility],
    ["Handguard interface", product.handguardInterface],
    ["Receiver interface", product.receiverInterface],
    ["Optic interface", product.opticInterface],
    ["Suppressor mounting", product.suppressorCompatibility],
    ["Barrel interface", product.barrelCompatibility],
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        <Link href="/catalog" className="hover:text-ink">
          Catalog
        </Link>
        <span>/</span>
        <Link href={`/catalog?category=${product.categorySlug}`} className="hover:text-ink">
          {categoryName(product.categorySlug)}
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {product.isDemo ? <DemoTag /> : null}
              <VerificationBadge status={product.verificationStatus} />
              <Badge tone="neutral">{categoryName(product.categorySlug)}</Badge>
              {product.regulatoryClass !== "UNREGULATED_ACCESSORY" &&
              product.regulatoryClass !== "UNCLASSIFIED" ? (
                <Badge tone="yellow">Regulated item</Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{product.productName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {product.manufacturerName} · Part {product.manufacturerPartNumber}
            </p>
            {product.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {product.description}
              </p>
            ) : null}
          </header>

          <Card>
            <CardContent className="p-0">
              <div className="h-52 border-b border-line">
                <PartSilhouette product={product} />
              </div>
              <p className="px-4 py-2 text-[11px] text-ink-faint">
                Schematic outline generated from published dimensions. Visual approximation — not an
                engineering drawing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Published specifications</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <DataRow
                label="Length"
                value={product.lengthMm === null ? notProvided() : formatLength(product.lengthMm)}
              />
              <DataRow
                label="Weight"
                value={
                  product.weightGrams === null ? notProvided() : formatMass(product.weightGrams)
                }
              />
              <DataRow
                label="Outer diameter"
                value={
                  product.diameterMm === null ? notProvided() : formatLength(product.diameterMm)
                }
              />
              <DataRow
                label="Inner bore"
                value={
                  product.innerDiameterMm === null
                    ? notProvided()
                    : formatLength(product.innerDiameterMm)
                }
              />
              <DataRow
                label="Width"
                value={product.widthMm === null ? notProvided() : formatLength(product.widthMm)}
              />
              <DataRow
                label="Height"
                value={product.heightMm === null ? notProvided() : formatLength(product.heightMm)}
              />
              <DataRow label="Platform" value={platformName(product.platform)} />
              <DataRow label="Caliber" value={product.caliber ?? notProvided()} />
              <DataRow label="Material" value={product.material ?? notProvided()} />
              <DataRow label="Finish" value={product.finish ?? notProvided()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documented interfaces</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {interfaces.map(([label, value]) => (
                <DataRow
                  key={label}
                  label={label}
                  value={value ? interfaceName(value) : notProvided()}
                />
              ))}
            </CardContent>
          </Card>

          {product.dimensions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Additional measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {product.dimensions.map((dimension) => (
                  <DataRow
                    key={dimension.kind}
                    label={dimension.label}
                    value={
                      dimension.valueMm === null
                        ? notProvided()
                        : `${formatLength(dimension.valueMm)} / ${formatLength(dimension.valueMm, "metric")}`
                    }
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Compatibility rules referencing this component</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                Rules are authored and sourced. They decide compatibility in the Build Studio —
                nothing is inferred.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {rules.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No rule covers this category yet, so connections involving it resolve UNKNOWN.
                </p>
              ) : (
                rules.map((rule) => (
                  <div key={rule.id} className="rounded border border-line bg-elevated p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-ink">{rule.name}</p>
                      <CompatibilityBadge state={rule.result as CompatibilityState} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                      {rule.explanation}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{rule.kind.replace(/_/g, " ")}</Badge>
                      <VerificationBadge status={rule.verificationStatus} />
                      {rule.sourceUrl ? (
                        <a
                          href={rule.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                        >
                          Source <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="label-micro">Best observed price</p>
              <p className="mt-1 font-mono text-2xl text-ink">
                {price === null ? "—" : formatMoney(price, product.currency)}
              </p>
              {product.msrpCents !== null && product.currentPriceCents !== null &&
              product.currentPriceCents < product.msrpCents ? (
                <p className="text-xs text-signal-green">
                  {formatMoney(product.msrpCents - product.currentPriceCents)} below MSRP
                </p>
              ) : product.msrpCents !== null ? (
                <p className="text-xs text-ink-faint">
                  MSRP {formatMoney(product.msrpCents, product.currency)}
                </p>
              ) : null}

              <Separator className="my-3" />

              <ProductActions
                productId={product.id}
                isWatched={Boolean(watchItem)}
                builds={builds}
                signedIn={Boolean(user)}
              />

              {product.regulatoryClass === "NFA_ITEM" ||
              product.regulatoryClass === "SERIALIZED_COMPONENT" ? (
                <p className="mt-3 rounded border border-signal-yellow/40 bg-signal-yellow/10 px-2.5 py-2 text-[11px] leading-relaxed text-signal-yellow">
                  Regulated item. BuildSight links to the manufacturer&rsquo;s or retailer&rsquo;s
                  own purchasing process and never automates a purchase.
                </p>
              ) : null}

              <div className="mt-3 space-y-1.5">
                {product.productUrl ? (
                  <ExternalLinkRow href={product.productUrl} label="Official product page" />
                ) : null}
                {product.manufacturerUrl ? (
                  <ExternalLinkRow href={product.manufacturerUrl} label="Manufacturer" />
                ) : null}
                {product.manualUrl ? (
                  <ExternalLinkRow href={product.manualUrl} label="Manual (PDF)" icon="doc" />
                ) : null}
                {product.technicalDrawingUrl ? (
                  <ExternalLinkRow
                    href={product.technicalDrawingUrl}
                    label="Technical drawing"
                    icon="ruler"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistory productId={product.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl text-ink">
                  {product.dataQualityScore ?? "—"}
                </span>
                <Badge
                  tone={
                    quality.state === "GREEN" ? "green" : quality.state === "YELLOW" ? "yellow" : "red"
                  }
                >
                  {quality.label}
                </Badge>
              </div>
              <Meter
                className="mt-2"
                value={product.dataQualityScore ?? 0}
                tone={
                  quality.state === "GREEN" ? "green" : quality.state === "YELLOW" ? "yellow" : "red"
                }
              />
              <p className="mt-2 text-[11px] text-ink-muted" title={verificationHelp(product.verificationStatus)}>
                {product.sourceUrl ? (
                  <>
                    Sourced from{" "}
                    <a
                      href={product.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:underline"
                    >
                      the published record
                    </a>
                    {product.lastVerified
                      ? `, verified ${product.lastVerified.slice(0, 10)}.`
                      : "."}
                  </>
                ) : (
                  "No source URL recorded for this product."
                )}
              </p>
              {product.dataQualityIssues.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {product.dataQualityIssues.slice(0, 6).map((issue) => (
                    <li key={issue.code + issue.field} className="text-[11px] text-ink-faint">
                      <span
                        className={
                          issue.severity === "ERROR"
                            ? "text-signal-red"
                            : issue.severity === "WARNING"
                              ? "text-signal-yellow"
                              : "text-ink-faint"
                        }
                      >
                        {issue.severity}
                      </span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Link href="/studio" className="block">
            <Button variant="outline" className="w-full">
              Open the Build Studio
            </Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}

function notProvided() {
  return (
    <span className="text-ink-faint" title={NOT_PROVIDED}>
      Not provided
    </span>
  );
}

function ExternalLinkRow({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: "doc" | "ruler";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center justify-between rounded border border-line bg-elevated px-2.5 py-2 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <span className="inline-flex items-center gap-2">
        {icon === "doc" ? <FileText className="size-3.5" /> : null}
        {icon === "ruler" ? <Ruler className="size-3.5" /> : null}
        {label}
      </span>
      <ExternalLink className="size-3.5" />
    </a>
  );
}
