import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        emphasis ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums",
          emphasis ? "text-3xl text-brand-700" : "text-2xl text-slate-900",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
