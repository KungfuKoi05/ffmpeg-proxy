"use client";

import { useMemo } from "react";
import { assemblyBounds, type PlacedPart } from "@/lib/assembly/geometry";
import { formatLength } from "@/lib/units";
import { cn } from "@/lib/utils";

export type TechnicalViewMode = "side" | "top" | "front" | "section";

interface Projected {
  part: PlacedPart;
  /** Rectangle in millimetres, y measured upward from the assembly origin. */
  x: number;
  y: number;
  width: number;
  height: number;
  round: boolean;
  innerHeight: number | null;
}

/**
 * Orthographic technical views generated from the same placement geometry the
 * 3D viewer uses. Every dimension annotation comes from the database; parts
 * with substituted dimensions are drawn with a dashed outline.
 */
export function TechnicalView({
  parts,
  mode,
  showMeasurements,
  selectedProductId,
  onSelect,
  className,
}: {
  parts: PlacedPart[];
  mode: TechnicalViewMode;
  showMeasurements: boolean;
  selectedProductId: string | null;
  onSelect?: (productId: string | null) => void;
  className?: string;
}) {
  const projected = useMemo(() => parts.map((part) => project(part, mode)), [parts, mode]);
  const bounds = useMemo(() => assemblyBounds(parts), [parts]);

  if (parts.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <p className="text-xs text-ink-muted">Add components to generate a technical view.</p>
      </div>
    );
  }

  const minX = Math.min(...projected.map((item) => item.x));
  const maxX = Math.max(...projected.map((item) => item.x + item.width));
  const minY = Math.min(...projected.map((item) => item.y));
  const maxY = Math.max(...projected.map((item) => item.y + item.height));

  const padX = Math.max(30, (maxX - minX) * 0.06);
  const padY = Math.max(40, (maxY - minY) * 0.3);
  const viewWidth = maxX - minX + padX * 2;
  const viewHeight = maxY - minY + padY * 2 + (showMeasurements ? 100 : 0);

  // SVG y grows downward; flip so the assembly reads the right way up.
  const toSvgY = (y: number, height: number) => maxY - y - height;

  return (
    <svg
      viewBox={`${minX - padX} ${-padY} ${viewWidth} ${viewHeight}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`${mode} technical view`}
    >
      <defs>
        <pattern id="section-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        </pattern>
      </defs>

      {/* Centre line along the assembly axis. */}
      {mode !== "front" ? (
        <line
          x1={minX - padX / 2}
          y1={toSvgY(0, 0)}
          x2={maxX + padX / 2}
          y2={toSvgY(0, 0)}
          stroke="currentColor"
          className="text-line-strong"
          strokeWidth="1"
          strokeDasharray="18 6 3 6"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {projected.map((item) => {
        const selected = item.part.productId === selectedProductId;
        const approximated = item.part.lengthApproximate;
        const y = toSvgY(item.y, item.height);
        return (
          <g
            key={`${item.part.productId}-${item.part.slotKey}`}
            onClick={() => onSelect?.(selected ? null : item.part.productId)}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <rect
              x={item.x}
              y={y}
              width={item.width}
              height={item.height}
              rx={item.round ? Math.min(item.height / 2, 6) : 2}
              className={cn(
                selected ? "text-accent" : "text-ink-muted",
                mode === "section" ? "opacity-90" : "opacity-80",
              )}
              fill={mode === "section" ? "url(#section-hatch)" : "currentColor"}
              fillOpacity={mode === "section" ? 1 : 0.16}
              stroke="currentColor"
              strokeWidth={selected ? 2 : 1.2}
              strokeDasharray={approximated ? "6 4" : undefined}
              vectorEffect="non-scaling-stroke"
            />
            {mode === "section" && item.innerHeight ? (
              <rect
                x={item.x}
                y={toSvgY(item.y + (item.height - item.innerHeight) / 2, item.innerHeight)}
                width={item.width}
                height={item.innerHeight}
                className="text-base"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        );
      })}

      {showMeasurements ? (
        <MeasurementBand
          projected={projected}
          minX={minX}
          maxX={maxX}
          baselineY={toSvgY(minY, 0) + 26}
          overallLengthMm={bounds.size[0]}
        />
      ) : null}
    </svg>
  );
}

function MeasurementBand({
  projected,
  minX,
  maxX,
  baselineY,
  overallLengthMm,
}: {
  projected: Projected[];
  minX: number;
  maxX: number;
  baselineY: number;
  overallLengthMm: number;
}) {
  // Only annotate parts wide enough for a readable dimension line, and stagger
  // them across three rows so adjacent labels cannot collide.
  const span = Math.max(1, maxX - minX);
  const axial = projected
    .filter((item) => item.width > span * 0.06)
    .sort((a, b) => a.x - b.x)
    .slice(0, 8);

  return (
    <g className="text-accent" stroke="currentColor" fill="currentColor">
      {axial.map((item, index) => {
        const y = baselineY + (index % 3) * 15;
        return (
          <g key={`${item.part.productId}-dim`}>
            <line x1={item.x} y1={y} x2={item.x + item.width} y2={y} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line x1={item.x} y1={y - 4} x2={item.x} y2={y + 4} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line
              x1={item.x + item.width}
              y1={y - 4}
              x2={item.x + item.width}
              y2={y + 4}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={item.x + item.width / 2}
              y={y - 6}
              textAnchor="middle"
              fontSize="13"
              stroke="none"
              className="font-mono"
            >
              {formatLength(item.part.lengthMm)}
              {item.part.defaultedDimensions.includes("length") ? " ~" : ""}
            </text>
          </g>
        );
      })}

      <g className="text-ink-muted" stroke="currentColor" fill="currentColor">
        <line x1={minX} y1={baselineY + 60} x2={maxX} y2={baselineY + 60} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={minX} y1={baselineY + 55} x2={minX} y2={baselineY + 65} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={maxX} y1={baselineY + 55} x2={maxX} y2={baselineY + 65} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <text
          x={(minX + maxX) / 2}
          y={baselineY + 54}
          textAnchor="middle"
          fontSize="14"
          stroke="none"
          className="font-mono"
        >
          Envelope {formatLength(overallLengthMm)}
        </text>
      </g>
    </g>
  );
}

function project(part: PlacedPart, mode: TechnicalViewMode): Projected {
  const isRound = part.shape !== "box";
  const depth = isRound ? part.diameterMm : part.widthMm;
  const height = isRound ? part.diameterMm : part.heightMm;

  if (mode === "top") {
    return {
      part,
      x: part.position[0] - part.lengthMm / 2,
      y: part.position[2] - depth / 2,
      width: part.lengthMm,
      height: depth,
      round: isRound,
      innerHeight: part.innerDiameterMm,
    };
  }

  if (mode === "front") {
    return {
      part,
      x: part.position[2] - depth / 2,
      y: part.position[1] - height / 2,
      width: depth,
      height,
      round: isRound,
      innerHeight: part.innerDiameterMm,
    };
  }

  // Side and section share the same projection; section adds the bore.
  return {
    part,
    x: part.position[0] - part.lengthMm / 2,
    y: part.position[1] - height / 2,
    width: part.lengthMm,
    height,
    round: isRound,
    innerHeight: part.innerDiameterMm,
  };
}
