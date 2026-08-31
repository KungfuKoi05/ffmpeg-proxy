import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { builds: true, watchlist: true } } },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {users.length} account{users.length === 1 ? "" : "s"}. Passwords are stored only as bcrypt
          hashes and are never displayed or exported.
        </p>
      </header>

      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-elevated">
            <tr>
              {["Email", "Name", "Role", "Plan", "Builds", "Watchlist", "Joined"].map((heading) => (
                <th
                  key={heading}
                  className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-ink">{user.email}</td>
                <td className="px-3 py-2 text-ink-muted">{user.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
                </td>
                <td className="px-3 py-2 text-ink-muted">{user.plan}</td>
                <td className="px-3 py-2 font-mono text-ink-muted">{user._count.builds}</td>
                <td className="px-3 py-2 font-mono text-ink-muted">{user._count.watchlist}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
