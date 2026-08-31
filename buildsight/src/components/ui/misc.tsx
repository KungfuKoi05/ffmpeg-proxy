import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn("h-px w-full bg-line", className)} {...props} />;
}

export function Meter({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "green" | "yellow" | "red";
}) {
  const toneClass = {
    accent: "bg-accent",
    green: "bg-signal-green",
    yellow: "bg-signal-yellow",
    red: "bg-signal-red",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)}>
      <div
        className={cn("h-full rounded-full transition-all", toneClass)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line px-6 py-12 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DataRow({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <span className="label-micro shrink-0">{label}</span>
      <span className="text-right font-mono text-xs text-ink" title={hint}>
        {value}
      </span>
    </div>
  );
}

export function PanelHeading({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-between gap-2 border-b border-line bg-elevated/60 px-3",
        className,
      )}
    >
      <span className="label-micro">{title}</span>
      {action}
    </div>
  );
}

/** Marks synthetic demo records so they can never be mistaken for real data. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent",
        className,
      )}
      title="Synthetic demonstration data. Not a manufacturer specification."
    >
      Demo
    </span>
  );
}
