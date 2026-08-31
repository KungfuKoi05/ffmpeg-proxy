import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts } from "@/server/products";
import { serializeProduct } from "@/server/serializers";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { CATEGORIES, PLATFORMS, CALIBERS, VERIFICATION_LABELS } from "@/lib/catalog/vocabulary";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Browse component records with published specifications and sources.",
};

interface CatalogSearchParams {
  q?: string;
  category?: string;
  manufacturer?: string;
  platform?: string;
  caliber?: string;
  verification?: string;
  sort?: string;
  page?: string;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;

  const [result, manufacturers] = await Promise.all([
    searchProducts({
      q: params.q,
      categorySlug: params.category,
      manufacturerSlug: params.manufacturer,
      platform: params.platform,
      caliber: params.caliber,
      verificationStatus: params.verification,
      sort: (params.sort as "relevance" | undefined) ?? undefined,
      page,
      pageSize: 24,
    }),
    prisma.manufacturer.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);

  const products = result.products.map(serializeProduct);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Component catalog</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {result.total.toLocaleString()} published record
            {result.total === 1 ? "" : "s"}. Every specification carries a source and a
            verification level.
          </p>
        </div>
        <Link href="/studio">
          <Button variant="primary" size="sm">
            Open Build Studio
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside>
          <Card>
            <CardContent className="p-4">
              <form className="space-y-4" method="get">
                <div>
                  <Label htmlFor="q">Search</Label>
                  <Input
                    id="q"
                    name="q"
                    defaultValue={params.q ?? ""}
                    placeholder="15 inch handguard"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select id="category" name="category" defaultValue={params.category ?? ""}>
                    <option value="">All</option>
                    {CATEGORIES.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Select id="manufacturer" name="manufacturer" defaultValue={params.manufacturer ?? ""}>
                    <option value="">All</option>
                    {manufacturers.map((manufacturer) => (
                      <option key={manufacturer.slug} value={manufacturer.slug}>
                        {manufacturer.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <Select id="platform" name="platform" defaultValue={params.platform ?? ""}>
                    <option value="">All</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform.slug} value={platform.slug}>
                        {platform.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="caliber">Caliber</Label>
                  <Select id="caliber" name="caliber" defaultValue={params.caliber ?? ""}>
                    <option value="">All</option>
                    {CALIBERS.map((caliber) => (
                      <option key={caliber} value={caliber}>
                        {caliber}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="verification">Verification</Label>
                  <Select id="verification" name="verification" defaultValue={params.verification ?? ""}>
                    <option value="">Any level</option>
                    {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sort">Sort</Label>
                  <Select id="sort" name="sort" defaultValue={params.sort ?? "relevance"}>
                    <option value="relevance">Relevance</option>
                    <option value="price-asc">Price, low to high</option>
                    <option value="price-desc">Price, high to low</option>
                    <option value="weight-asc">Weight, light to heavy</option>
                    <option value="name-asc">Name</option>
                    <option value="newest">Recently added</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" size="sm" className="flex-1">
                    Apply
                  </Button>
                  <Link href="/catalog">
                    <Button variant="ghost" size="sm">
                      Reset
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </aside>

        <div>
          {result.usedFallback ? (
            <p className="mb-3 rounded border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
              No full-text matches; showing substring matches instead.
            </p>
          ) : null}

          {products.length === 0 ? (
            <EmptyState
              title="No catalog records match those filters"
              description="Try a broader search. Results come from published catalog data only — nothing is generated to fill a gap."
              action={
                <Link href="/catalog">
                  <Button size="sm">Clear filters</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <PageLink params={params} page={page - 1} disabled={page <= 1} label="Previous" />
              <span className="font-mono text-xs text-ink-muted">
                Page {page} of {pageCount}
              </span>
              <PageLink
                params={params}
                page={page + 1}
                disabled={page >= pageCount}
                label="Next"
              />
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  label,
}: {
  params: CatalogSearchParams;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <Button size="sm" variant="ghost" disabled>
        {label}
      </Button>
    );
  }
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  );
  query.set("page", String(page));
  return (
    <Link href={`/catalog?${query.toString()}`}>
      <Button size="sm" variant="secondary">
        {label}
      </Button>
    </Link>
  );
}
