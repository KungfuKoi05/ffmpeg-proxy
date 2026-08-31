import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { saveProductAction } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toNumber } from "@/lib/units";
import type { DataQualityIssue } from "@/lib/quality/data-quality";

export const metadata: Metadata = { title: "Edit product · Admin" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, manufacturers] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { category: { select: { slug: true } } },
    }),
    prisma.manufacturer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const issues = (product.dataQualityIssues as DataQualityIssue[] | null) ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{product.productName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {product.manufacturerPartNumber} · quality {product.dataQualityScore ?? "—"}
          </p>
        </div>
        <Link href={`/catalog/${product.slug}`} className="text-xs text-accent hover:underline">
          View public page
        </Link>
      </header>

      {issues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Data quality findings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {issues.map((issue) => (
              <p key={`${issue.code}-${issue.field}`} className="text-xs">
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
                <span className="text-ink-muted">{issue.message}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ProductForm
        action={saveProductAction}
        manufacturers={manufacturers}
        values={{
          id: product.id,
          manufacturerId: product.manufacturerId,
          manufacturerPartNumber: product.manufacturerPartNumber,
          productName: product.productName,
          categorySlug: product.category.slug,
          platform: product.platform,
          caliber: product.caliber,
          msrpCents: product.msrpCents,
          weightGrams: product.weightGrams,
          lengthMm: toNumber(product.lengthMm),
          widthMm: toNumber(product.widthMm),
          heightMm: toNumber(product.heightMm),
          diameterMm: toNumber(product.diameterMm),
          innerDiameterMm: toNumber(product.innerDiameterMm),
          material: product.material,
          finish: product.finish,
          mountingInterface: product.mountingInterface,
          threadSpecification: product.threadSpecification,
          gasSystemCompatibility: product.gasSystemCompatibility,
          handguardInterface: product.handguardInterface,
          receiverInterface: product.receiverInterface,
          opticInterface: product.opticInterface,
          suppressorCompatibility: product.suppressorCompatibility,
          barrelCompatibility: product.barrelCompatibility,
          description: product.description,
          manufacturerUrl: product.manufacturerUrl,
          productUrl: product.productUrl,
          imageUrl: product.imageUrl,
          technicalDrawingUrl: product.technicalDrawingUrl,
          manualUrl: product.manualUrl,
          sourceUrl: product.sourceUrl,
          verificationStatus: product.verificationStatus,
          availability: product.availability,
          regulatoryClass: product.regulatoryClass,
          publishState: product.publishState,
          lastVerified: product.lastVerified ? product.lastVerified.toISOString() : null,
        }}
      />
    </div>
  );
}
