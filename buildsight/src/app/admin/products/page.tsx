import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { VerificationBadge } from "@/components/ui/signal";
import { formatMoney } from "@/lib/units";
import { formatRelative } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Products · Admin" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 25;

  const where: Prisma.ProductWhereInput = {};
  if (params.q) {
    where.OR = [
      { productName: { contains: params.q, mode: "insensitive" } },
      { manufacturerPartNumber: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.state) where.publishState = params.state as Prisma.EnumPublishStateFilter["equals"];

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { manufacturer: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">{total.toLocaleString()} records</p>
        </div>
        <Link href="/admin/products/new">
          <Button size="sm" variant="primary">
            New product
          </Button>
        </Link>
      </header>

      <Card>
        <CardContent className="p-3">
          <form className="flex flex-wrap gap-2" method="get">
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search name or part number"
              className="w-64"
            />
            <Select name="state" defaultValue={params.state ?? ""} className="w-48">
              <option value="">All states</option>
              {["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"].map((state) => (
                <option key={state} value={state}>
                  {state.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            <Button type="submit" size="md" variant="secondary">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-elevated">
            <tr>
              {["Product", "Category", "Part no.", "MSRP", "Quality", "Verification", "State", "Updated"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${product.id}`} className="text-ink hover:text-accent">
                    {product.productName}
                  </Link>
                  <p className="text-[11px] text-ink-muted">{product.manufacturer.name}</p>
                </td>
                <td className="px-3 py-2 text-ink-muted">{product.category.name}</td>
                <td className="px-3 py-2 font-mono text-ink-muted">
                  {product.manufacturerPartNumber}
                </td>
                <td className="px-3 py-2 font-mono text-ink-muted">
                  {product.msrpCents === null ? "—" : formatMoney(product.msrpCents)}
                </td>
                <td className="px-3 py-2 font-mono">
                  <span
                    className={
                      (product.dataQualityScore ?? 0) >= 85
                        ? "text-signal-green"
                        : (product.dataQualityScore ?? 0) >= 60
                          ? "text-signal-yellow"
                          : "text-signal-red"
                    }
                  >
                    {product.dataQualityScore ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <VerificationBadge status={product.verificationStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge tone={product.publishState === "PUBLISHED" ? "green" : "yellow"}>
                    {product.publishState}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatRelative(product.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize ? (
        <nav className="flex items-center justify-between">
          <Link href={`/admin/products?page=${Math.max(1, page - 1)}`}>
            <Button size="sm" variant="ghost" disabled={page <= 1}>
              Previous
            </Button>
          </Link>
          <span className="font-mono text-xs text-ink-muted">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <Link href={`/admin/products?page=${page + 1}`}>
            <Button size="sm" variant="ghost" disabled={page >= Math.ceil(total / pageSize)}>
              Next
            </Button>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
