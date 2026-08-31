import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listBuilds, summarizeBuildRecord } from "@/server/builds";
import { BuildCard } from "@/components/build-card";
import { BuildActions } from "@/components/build-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { entitlements } from "@/lib/plans";

export const metadata: Metadata = { title: "My builds" };

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { archived } = await searchParams;
  const showArchived = archived === "true";
  const builds = await listBuilds(user.id, true);
  const visible = builds.filter((build) => build.isArchived === showArchived);

  const summaries = await Promise.all(
    visible.map(async (build) => ({
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      isArchived: build.isArchived,
      updatedAt: build.updatedAt.toISOString(),
      summary: await summarizeBuildRecord(build),
    })),
  );

  const plan = entitlements(user.plan);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My builds</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {plan.maxBuilds === null
              ? "Unlimited saved configurations on your plan."
              : `${builds.filter((build) => !build.isArchived).length} of ${plan.maxBuilds} saved configurations used.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={showArchived ? "/builds" : "/builds?archived=true"}>
            <Button size="sm" variant="ghost">
              {showArchived ? "Show active" : "Show archived"}
            </Button>
          </Link>
          <Link href="/studio">
            <Button size="sm" variant="primary">
              New configuration
            </Button>
          </Link>
        </div>
      </header>

      {summaries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={showArchived ? "No archived configurations" : "No configurations yet"}
            description="Configurations you save from the Build Studio appear here with their cost, weight and compatibility status."
            action={
              <Link href="/studio">
                <Button size="sm" variant="primary">
                  Open Build Studio
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {summaries.map((build) => (
            <div key={build.id} className="space-y-2">
              <BuildCard build={build} />
              <div className="px-1">
                <BuildActions
                  buildId={build.id}
                  name={build.name}
                  isArchived={build.isArchived}
                  canExportPdf={plan.pdfExport}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
