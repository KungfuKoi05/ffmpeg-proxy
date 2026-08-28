import Link from "next/link";
import { requireBusiness } from "@/lib/auth/session";
import { getOverview } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { Overview } from "@/components/overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireBusiness();
  const data = await getOverview(ctx.business.id);

  const banner = !ctx.business.onboarding_completed ? (
    <div className="bg-amber-100 px-6 py-2 text-center text-sm text-amber-900">
      Setup isn&apos;t finished — your receptionist isn&apos;t live yet.{" "}
      <Link href="/onboarding" className="font-medium underline">
        Finish setup
      </Link>
    </div>
  ) : null;

  return (
    <DashboardShell businessName={ctx.business.name} active="/dashboard" banner={banner}>
      <Overview data={data} />
    </DashboardShell>
  );
}
