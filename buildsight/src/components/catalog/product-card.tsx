import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationBadge } from "@/components/ui/signal";
import { DemoTag } from "@/components/ui/misc";
import { formatLength, formatMass, formatMoney, NOT_PROVIDED } from "@/lib/units";
import { categoryName } from "@/lib/catalog/vocabulary";
import type { SerializedProduct } from "@/server/serializers";

const AVAILABILITY_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  BACKORDER: "Backorder",
  OUT_OF_STOCK: "Out of stock",
  DISCONTINUED: "Discontinued",
  UNKNOWN: "Availability unknown",
};

export function ProductCard({ product }: { product: SerializedProduct }) {
  const price = product.currentPriceCents ?? product.msrpCents;
  return (
    <Card className="group transition-colors hover:border-line-strong">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="label-micro">{categoryName(product.categorySlug)}</p>
            <Link href={`/catalog/${product.slug}`} className="mt-1 block">
              <h3 className="truncate text-sm font-medium text-ink group-hover:text-accent">
                {product.productName}
              </h3>
            </Link>
            <p className="truncate text-xs text-ink-muted">{product.manufacturerName}</p>
          </div>
          {product.isDemo ? <DemoTag /> : null}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-line py-2.5 font-mono text-[10px]">
          <Spec
            label="Length"
            value={product.lengthMm === null ? "—" : formatLength(product.lengthMm)}
            hint={product.lengthMm === null ? NOT_PROVIDED : undefined}
          />
          <Spec
            label="Weight"
            value={product.weightGrams === null ? "—" : formatMass(product.weightGrams)}
            hint={product.weightGrams === null ? NOT_PROVIDED : undefined}
          />
          <Spec
            label="Price"
            value={price === null ? "—" : formatMoney(price, product.currency, { showCents: false })}
          />
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <VerificationBadge status={product.verificationStatus} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {AVAILABILITY_LABEL[product.availability] ?? product.availability}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <p className="font-mono text-[10px] text-ink-faint">{product.manufacturerPartNumber}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Spec({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-ink-muted">{value}</dd>
    </div>
  );
}
