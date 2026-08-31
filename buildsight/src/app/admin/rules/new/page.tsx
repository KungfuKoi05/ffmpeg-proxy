import type { Metadata } from "next";
import { RuleForm } from "@/components/admin/rule-form";
import { saveRuleAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "New rule · Admin" };

export default function NewRulePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New compatibility rule</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Write the explanation as the user will read it. It is shown verbatim next to the result in
          the Build Studio, so it should say what was compared and where the claim comes from.
        </p>
      </header>
      <RuleForm action={saveRuleAction} />
    </div>
  );
}
