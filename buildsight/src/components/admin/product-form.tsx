"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CATEGORIES,
  PLATFORMS,
  CALIBERS,
  VERIFICATION_LABELS,
  interfacesForField,
  type InterfaceField,
} from "@/lib/catalog/vocabulary";
import type { AdminFormState } from "@/server/actions/admin";

export interface ProductFormValues {
  id?: string;
  manufacturerId: string;
  manufacturerPartNumber: string;
  productName: string;
  categorySlug: string;
  platform: string | null;
  caliber: string | null;
  msrpCents: number | null;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  diameterMm: number | null;
  innerDiameterMm: number | null;
  material: string | null;
  finish: string | null;
  mountingInterface: string | null;
  threadSpecification: string | null;
  gasSystemCompatibility: string | null;
  handguardInterface: string | null;
  receiverInterface: string | null;
  opticInterface: string | null;
  suppressorCompatibility: string | null;
  barrelCompatibility: string | null;
  description: string | null;
  manufacturerUrl: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  technicalDrawingUrl: string | null;
  manualUrl: string | null;
  sourceUrl: string | null;
  verificationStatus: string;
  availability: string;
  regulatoryClass: string;
  publishState: string;
  lastVerified: string | null;
}

const INTERFACE_FIELDS: Array<{ field: InterfaceField; label: string }> = [
  { field: "mountingInterface", label: "Mounting interface" },
  { field: "threadSpecification", label: "Thread specification" },
  { field: "gasSystemCompatibility", label: "Gas system" },
  { field: "handguardInterface", label: "Handguard interface" },
  { field: "receiverInterface", label: "Receiver interface" },
  { field: "opticInterface", label: "Optic interface" },
  { field: "suppressorCompatibility", label: "Suppressor mounting" },
  { field: "barrelCompatibility", label: "Barrel interface" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Catalog entry form.
 *
 * Interface values are chosen from the controlled vocabulary rather than typed
 * free-hand: an unrecognised interface would silently produce UNKNOWN results
 * in the compatibility engine.
 */
export function ProductForm({
  action,
  manufacturers,
  values,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  manufacturers: Array<{ id: string; name: string }>;
  values?: Partial<ProductFormValues>;
}) {
  const [state, formAction] = useActionState(action, {} as AdminFormState);

  return (
    <form action={formAction} className="space-y-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {state.error ? (
        <p className="rounded border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">
          {state.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Manufacturer" errors={state.fieldErrors?.manufacturerId}>
            <Select name="manufacturerId" defaultValue={values?.manufacturerId ?? ""} required>
              <option value="">Select…</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Part number" errors={state.fieldErrors?.manufacturerPartNumber}>
            <Input
              name="manufacturerPartNumber"
              defaultValue={values?.manufacturerPartNumber ?? ""}
              required
              maxLength={80}
            />
          </Field>
          <Field label="Product name" errors={state.fieldErrors?.productName}>
            <Input name="productName" defaultValue={values?.productName ?? ""} required maxLength={160} />
          </Field>
          <Field label="Category" errors={state.fieldErrors?.categorySlug}>
            <Select name="categorySlug" defaultValue={values?.categorySlug ?? ""} required>
              <option value="">Select…</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Platform">
            <Select name="platform" defaultValue={values?.platform ?? ""}>
              <option value="">Not specified</option>
              {PLATFORMS.map((platform) => (
                <option key={platform.slug} value={platform.slug}>
                  {platform.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Caliber">
            <Select name="caliber" defaultValue={values?.caliber ?? ""}>
              <option value="">Not specified</option>
              {CALIBERS.map((caliber) => (
                <option key={caliber} value={caliber}>
                  {caliber}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea name="description" defaultValue={values?.description ?? ""} maxLength={4000} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published measurements</CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            Leave a field empty when the manufacturer does not publish it. Empty is displayed as
            &ldquo;Not provided by manufacturer.&rdquo; — never estimated.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="MSRP (USD)" errors={state.fieldErrors?.msrpCents}>
            <Input
              name="msrp"
              inputMode="decimal"
              defaultValue={values?.msrpCents != null ? (values.msrpCents / 100).toFixed(2) : ""}
            />
          </Field>
          <Field label="Weight (g)">
            <Input name="weightGrams" inputMode="numeric" defaultValue={values?.weightGrams ?? ""} />
          </Field>
          <Field label="Length (mm)">
            <Input name="lengthMm" inputMode="decimal" defaultValue={values?.lengthMm ?? ""} />
          </Field>
          <Field label="Width (mm)">
            <Input name="widthMm" inputMode="decimal" defaultValue={values?.widthMm ?? ""} />
          </Field>
          <Field label="Height (mm)">
            <Input name="heightMm" inputMode="decimal" defaultValue={values?.heightMm ?? ""} />
          </Field>
          <Field label="Outer diameter (mm)">
            <Input name="diameterMm" inputMode="decimal" defaultValue={values?.diameterMm ?? ""} />
          </Field>
          <Field label="Inner bore (mm)">
            <Input
              name="innerDiameterMm"
              inputMode="decimal"
              defaultValue={values?.innerDiameterMm ?? ""}
            />
          </Field>
          <Field label="Material">
            <Input name="material" defaultValue={values?.material ?? ""} maxLength={120} />
          </Field>
          <Field label="Finish">
            <Input name="finish" defaultValue={values?.finish ?? ""} maxLength={120} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documented interfaces</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {INTERFACE_FIELDS.map(({ field, label }) => (
            <Field key={field} label={label}>
              <Select
                name={field}
                defaultValue={(values?.[field] as string | null | undefined) ?? ""}
              >
                <option value="">Not specified</option>
                {interfacesForField(field).map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provenance and status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Source URL" errors={state.fieldErrors?.sourceUrl}>
            <Input name="sourceUrl" type="url" defaultValue={values?.sourceUrl ?? ""} />
          </Field>
          <Field label="Last verified">
            <Input
              name="lastVerified"
              type="date"
              defaultValue={values?.lastVerified ? values.lastVerified.slice(0, 10) : ""}
            />
          </Field>
          <Field label="Verification status">
            <Select name="verificationStatus" defaultValue={values?.verificationStatus ?? "UNVERIFIED"}>
              {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Availability">
            <Select name="availability" defaultValue={values?.availability ?? "UNKNOWN"}>
              {["IN_STOCK", "LOW_STOCK", "BACKORDER", "OUT_OF_STOCK", "DISCONTINUED", "UNKNOWN"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Regulatory class">
            <Select name="regulatoryClass" defaultValue={values?.regulatoryClass ?? "UNCLASSIFIED"}>
              {[
                "UNCLASSIFIED",
                "UNREGULATED_ACCESSORY",
                "SERIALIZED_COMPONENT",
                "NFA_ITEM",
                "RESTRICTED_OTHER",
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publish state" errors={state.fieldErrors?.publishState}>
            <Select name="publishState" defaultValue={values?.publishState ?? "DRAFT"}>
              {["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"].map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product URL">
            <Input name="productUrl" type="url" defaultValue={values?.productUrl ?? ""} />
          </Field>
          <Field label="Manufacturer URL">
            <Input name="manufacturerUrl" type="url" defaultValue={values?.manufacturerUrl ?? ""} />
          </Field>
          <Field label="Manual URL">
            <Input name="manualUrl" type="url" defaultValue={values?.manualUrl ?? ""} />
          </Field>
          <Field label="Technical drawing URL">
            <Input
              name="technicalDrawingUrl"
              type="url"
              defaultValue={values?.technicalDrawingUrl ?? ""}
            />
          </Field>
          <Field label="Image URL">
            <Input name="imageUrl" type="url" defaultValue={values?.imageUrl ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Submit label={values?.id ? "Save product" : "Create product"} />
        <Link href="/admin/products">
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="mt-1 text-[11px] text-signal-red">{errors.join(" ")}</p>
      ) : null}
    </div>
  );
}
