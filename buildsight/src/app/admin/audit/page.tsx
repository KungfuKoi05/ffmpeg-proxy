import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const pageSize = 50;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {total.toLocaleString()} entries. Every catalog and account change is appended here with
          its actor and before/after payload.
        </p>
      </header>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{entry.action}</Badge>
                <span className="text-xs text-ink-muted">
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId}` : ""}
                </span>
              </div>
              <span className="text-[11px] text-ink-faint" title={formatDate(entry.createdAt)}>
                {entry.actor?.email ?? "system"} · {formatRelative(entry.createdAt)}
              </span>
            </div>
            {entry.before || entry.after ? (
              <pre className="mt-2 overflow-x-auto rounded bg-base p-2 font-mono text-[10px] text-ink-faint">
                {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
