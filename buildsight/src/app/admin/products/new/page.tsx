import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { saveProductAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "New product · Admin" };

export default async function NewProductPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Records are created as drafts. A source URL is required before a record can be published.
        </p>
      </header>
      <ProductForm action={saveProductAction} manufacturers={manufacturers} />
    </div>
  );
}
