"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES, VERIFICATION_LABELS, INTERFACE_FIELDS } from "@/lib/catalog/vocabulary";
import type { AdminFormState } from "@/server/actions/admin";

const KINDS = [
  { value: "INTERFACE_MATCH", hint: "Compare a documented interface field on both products." },
  { value: "THREAD_MATCH", hint: "Compare thread specifications." },
  { value: "PLATFORM_MATCH", hint: "Compare platform patterns." },
  { value: "CALIBER_MATCH", hint: "Compare chambering." },
  { value: "GAS_SYSTEM_MATCH", hint: "Compare gas system length." },
  {
    value: "DIMENSIONAL_CONSTRAINT",
    hint: 'Compare dimensions, e.g. {"subjectDimension":"length","targetDimension":"length","comparison":"lte","offsetMm":-10}.',
  },
  { value: "EXPLICIT_PAIR", hint: "Pin a documented result for two specific products." },
  {
    value: "REQUIRES_COMPONENT",
    hint: 'Require another category to be present, e.g. {"requiredCategorySlug":"mount"}.',
  },
  {
    value: "MUTUALLY_EXCLUSIVE",
    hint: 'Reject co-existing categories, e.g. {"exclusiveCategorySlugs":["a","b"]}.',
  },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : "Create rule"}
    </Button>
  );
}

/** Authoring form for a compatibility rule. */
export function RuleForm({
  action,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
}) {
  const [state, formAction] = useActionState(action, {} as AdminFormState);
  const [kind, setKind] = useState("INTERFACE_MATCH");
  const hint = KINDS.find((entry) => entry.value === kind)?.hint;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">
          {state.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input name="name" required maxLength={160} placeholder="Muzzle device thread matches the barrel thread" />
            {state.fieldErrors?.name ? (
              <p className="mt-1 text-[11px] text-signal-red">{state.fieldErrors.name.join(" ")}</p>
            ) : null}
          </div>

          <div>
            <Label>Kind</Label>
            <Select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
              {KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.value.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            {hint ? <p className="mt-1 text-[11px] text-ink-faint">{hint}</p> : null}
          </div>

          <div>
            <Label>Result when the rule matches</Label>
            <Select name="result" defaultValue="COMPATIBLE">
              {["COMPATIBLE", "CONDITIONAL", "INCOMPATIBLE", "UNKNOWN"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Subject category</Label>
            <Select name="subjectCategorySlug" defaultValue="">
              <option value="">Not scoped</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Target category</Label>
            <Select name="targetCategorySlug" defaultValue="">
              <option value="">Not scoped</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Subject field</Label>
            <Select name="subjectField" defaultValue="">
              <option value="">Not compared</option>
              {[...INTERFACE_FIELDS, "platform", "caliber"].map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Target field</Label>
            <Select name="targetField" defaultValue="">
              <option value="">Same as subject</option>
              {[...INTERFACE_FIELDS, "platform", "caliber"].map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Explanation shown to users</Label>
            <Textarea
              name="explanation"
              required
              minLength={10}
              maxLength={600}
              placeholder="Compatible — both products publish the same muzzle thread specification."
            />
            {state.fieldErrors?.explanation ? (
              <p className="mt-1 text-[11px] text-signal-red">
                {state.fieldErrors.explanation.join(" ")}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <Label>Condition (shown for conditional results)</Label>
            <Input name="condition" maxLength={400} />
          </div>

          <div className="sm:col-span-2">
            <Label>Parameters (JSON)</Label>
            <Textarea
              name="parameters"
              placeholder='{"mismatchResult":"CONDITIONAL","mismatchExplanation":"…"}'
              className="font-mono text-xs"
            />
            {state.fieldErrors?.parameters ? (
              <p className="mt-1 text-[11px] text-signal-red">
                {state.fieldErrors.parameters.join(" ")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Source URL</Label>
            <Input name="sourceUrl" type="url" />
          </div>
          <div>
            <Label>Verification status</Label>
            <Select name="verificationStatus" defaultValue="VERIFIED_MANUFACTURER">
              {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Priority (lower wins)</Label>
            <Input name="priority" type="number" defaultValue={100} min={1} max={1000} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              id="isActive"
              type="checkbox"
              name="isActive"
              defaultChecked
              className="size-4 accent-[var(--color-accent)]"
            />
            <label htmlFor="isActive" className="text-xs text-ink-muted">
              Active
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Submit />
        <Link href="/admin/rules">
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
