import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Manufacturers · Admin" };

export default async function AdminManufacturersPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Manufacturers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {manufacturers.length} manufacturer{manufacturers.length === 1 ? "" : "s"} in the catalog.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {manufacturers.map((manufacturer) => (
          <Card key={manufacturer.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{manufacturer.name}</p>
                  <p className="text-xs text-ink-muted">
                    {manufacturer.country ?? "Country not recorded"} ·{" "}
                    {manufacturer._count.products} products
                  </p>
                </div>
                {manufacturer.isDemo ? <Badge tone="accent">Demo</Badge> : null}
              </div>
              {manufacturer.description ? (
                <p className="mt-2 text-xs text-ink-muted">{manufacturer.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                {manufacturer.website ? (
                  <a
                    href={manufacturer.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    Website
                  </a>
                ) : null}
                {manufacturer.supportUrl ? (
                  <a
                    href={manufacturer.supportUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    Support
                  </a>
                ) : null}
                <Link
                  href={`/admin/products?q=${encodeURIComponent(manufacturer.name)}`}
                  className="text-accent hover:underline"
                >
                  Products
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
