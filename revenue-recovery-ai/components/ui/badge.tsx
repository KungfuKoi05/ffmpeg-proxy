import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-brand-100 text-brand-700",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof TONES {
  switch (status) {
    case "booked":
    case "completed":
    case "SAFE":
    case "active":
      return "success";
    case "qualified":
    case "contacted":
    case "HIGH_VALUE":
      return "info";
    case "lost":
    case "RISK":
    case "past_due":
      return "danger";
    case "NEEDS_HUMAN":
    case "new":
      return "warning";
    default:
      return "neutral";
  }
}
