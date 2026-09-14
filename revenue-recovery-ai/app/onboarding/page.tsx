import { requireUser } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await supabaseServer();

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, businesses(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const business = (membership as unknown as { businesses?: { id: string; name: string } })
    ?.businesses;

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your receptionist</h1>
        <p className="mt-1 text-sm text-slate-600">
          This is what the AI will know. It will never state anything you
          haven&apos;t configured here.
        </p>
        <div className="mt-8">
          <OnboardingWizard
            existingBusinessId={business?.id ?? null}
            existingName={business?.name ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
