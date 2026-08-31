import { cn } from "@/lib/utils";
import { formatLength } from "@/lib/units";
import type { SerializedProduct } from "@/server/serializers";

/**
 * A schematic silhouette drawn from the product's published dimensions.
 *
 * The catalog deliberately ships no product photography: a generated outline
 * from real numbers is honest, whereas a stock image would imply a likeness the
 * data does not support.
 */
export function PartSilhouette({
  product,
  className,
}: {
  product: SerializedProduct;
  className?: string;
}) {
  const length = product.lengthMm ?? 120;
  const height = product.heightMm ?? product.diameterMm ?? 40;
  const round = product.diameterMm !== null && product.heightMm === null;
  const known = product.lengthMm !== null;

  const viewWidth = 320;
  const viewHeight = 140;
  const scale = Math.min((viewWidth - 60) / length, (viewHeight - 60) / Math.max(height, 8));
  const width = length * scale;
  const drawHeight = Math.max(6, height * scale);
  const x = (viewWidth - width) / 2;
  const y = (viewHeight - drawHeight) / 2;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`Schematic outline of ${product.productName}`}
    >
      <rect width={viewWidth} height={viewHeight} className="fill-base" />
      <g className="text-line" stroke="currentColor" strokeWidth="0.5">
        {Array.from({ length: Math.ceil(viewWidth / 16) }, (_, index) => (
          <line key={`v${index}`} x1={index * 16} y1={0} x2={index * 16} y2={viewHeight} />
        ))}
        {Array.from({ length: Math.ceil(viewHeight / 16) }, (_, index) => (
          <line key={`h${index}`} x1={0} y1={index * 16} x2={viewWidth} y2={index * 16} />
        ))}
      </g>

      <rect
        x={x}
        y={y}
        width={width}
        height={drawHeight}
        rx={round ? drawHeight / 2 : 3}
        className="fill-elevated text-ink-muted"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray={known ? undefined : "5 4"}
      />

      <g className="text-accent" stroke="currentColor" fill="currentColor" strokeWidth="0.8">
        <line x1={x} y1={y + drawHeight + 14} x2={x + width} y2={y + drawHeight + 14} />
        <line x1={x} y1={y + drawHeight + 10} x2={x} y2={y + drawHeight + 18} />
        <line
          x1={x + width}
          y1={y + drawHeight + 10}
          x2={x + width}
          y2={y + drawHeight + 18}
        />
        <text
          x={viewWidth / 2}
          y={y + drawHeight + 30}
          textAnchor="middle"
          fontSize="10"
          stroke="none"
          className="font-mono"
        >
          {known ? formatLength(length) : "length not published"}
        </text>
      </g>
    </svg>
  );
}
