import { assemblyBounds, type PlacedPart } from "@/lib/assembly/geometry";

/** Compact side-elevation outline used in comparison and list views. */
export function BuildOutline({ parts }: { parts: PlacedPart[] }) {
  if (parts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          No components
        </span>
      </div>
    );
  }

  const bounds = assemblyBounds(parts);
  const padding = 12;
  const width = bounds.size[0] + padding * 2;
  const height = Math.max(bounds.size[1], 40) + padding * 2;

  return (
    <svg
      viewBox={`${bounds.min[0] - padding} ${-height / 2} ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Configuration outline"
    >
      {parts.map((part) => {
        const partHeight = part.shape === "box" ? part.heightMm : part.diameterMm;
        return (
          <rect
            key={`${part.productId}-${part.slotKey}`}
            x={part.position[0] - part.lengthMm / 2}
            y={-part.position[1] - partHeight / 2}
            width={part.lengthMm}
            height={partHeight}
            rx={part.shape === "box" ? 2 : Math.min(partHeight / 2, 5)}
            className="fill-elevated text-ink-muted"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray={part.lengthApproximate ? "6 4" : undefined}
            vectorEffect="non-scaling-stroke"
            fillOpacity={0.35}
          />
        );
      })}
    </svg>
  );
}
