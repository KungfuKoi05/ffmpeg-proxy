import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] leading-4 tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-elevated text-ink-muted",
        green: "border-signal-green/40 bg-signal-green/10 text-signal-green",
        yellow: "border-signal-yellow/40 bg-signal-yellow/10 text-signal-yellow",
        red: "border-signal-red/40 bg-signal-red/10 text-signal-red",
        gray: "border-signal-gray/40 bg-signal-gray/10 text-signal-gray",
        blue: "border-signal-blue/40 bg-signal-blue/10 text-signal-blue",
        accent: "border-accent/40 bg-accent/10 text-accent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
