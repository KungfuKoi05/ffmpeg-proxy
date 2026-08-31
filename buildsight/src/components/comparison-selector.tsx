"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Toggle which saved configurations appear in the comparison. */
export function ComparisonSelector({
  builds,
  selectedIds,
  limit,
}: {
  builds: Array<{ id: string; name: string }>;
  selectedIds: string[];
  limit: number;
}) {
  const router = useRouter();

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id].slice(-limit);
    router.push(next.length ? `/compare?builds=${next.join(",")}` : "/compare");
  }

  if (builds.length === 0) {
    return <p className="text-xs text-ink-muted">You have no saved configurations yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {builds.map((build) => {
        const active = selectedIds.includes(build.id);
        return (
          <button
            key={build.id}
            type="button"
            onClick={() => toggle(build.id)}
            aria-pressed={active}
            className={cn(
              "rounded border px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {build.name}
          </button>
        );
      })}
    </div>
  );
}
