"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { adminProductSchema, adminRuleSchema } from "@/lib/api/schemas";
import { refreshDerivedProductFields } from "@/server/admin";
import { writeAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { classifyRequest } from "@/lib/policy/policy";
import type { Prisma } from "@prisma/client";

export interface AdminFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
}

function optionalNumber(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

function productDataFromForm(formData: FormData) {
  return {
    manufacturerId: String(formData.get("manufacturerId") ?? ""),
    manufacturerPartNumber: String(formData.get("manufacturerPartNumber") ?? "").trim(),
    productName: String(formData.get("productName") ?? "").trim(),
    categorySlug: String(formData.get("categorySlug") ?? ""),
    platform: optionalText(formData.get("platform")),
    caliber: optionalText(formData.get("caliber")),
    msrpCents:
      optionalNumber(formData.get("msrp")) === null || optionalNumber(formData.get("msrp")) === undefined
        ? (optionalNumber(formData.get("msrp")) as null | undefined)
        : Math.round((optionalNumber(formData.get("msrp")) as number) * 100),
    weightGrams: optionalNumber(formData.get("weightGrams")),
    lengthMm: optionalNumber(formData.get("lengthMm")),
    widthMm: optionalNumber(formData.get("widthMm")),
    heightMm: optionalNumber(formData.get("heightMm")),
    diameterMm: optionalNumber(formData.get("diameterMm")),
    innerDiameterMm: optionalNumber(formData.get("innerDiameterMm")),
    material: optionalText(formData.get("material")),
    finish: optionalText(formData.get("finish")),
    mountingInterface: optionalText(formData.get("mountingInterface")),
    threadSpecification: optionalText(formData.get("threadSpecification")),
    gasSystemCompatibility: optionalText(formData.get("gasSystemCompatibility")),
    handguardInterface: optionalText(formData.get("handguardInterface")),
    receiverInterface: optionalText(formData.get("receiverInterface")),
    opticInterface: optionalText(formData.get("opticInterface")),
    suppressorCompatibility: optionalText(formData.get("suppressorCompatibility")),
    barrelCompatibility: optionalText(formData.get("barrelCompatibility")),
    description: optionalText(formData.get("description")),
    manufacturerUrl: optionalText(formData.get("manufacturerUrl")),
    productUrl: optionalText(formData.get("productUrl")),
    imageUrl: optionalText(formData.get("imageUrl")),
    technicalDrawingUrl: optionalText(formData.get("technicalDrawingUrl")),
    manualUrl: optionalText(formData.get("manualUrl")),
    sourceUrl: optionalText(formData.get("sourceUrl")),
    verificationStatus: String(formData.get("verificationStatus") ?? "UNVERIFIED"),
    availability: String(formData.get("availability") ?? "UNKNOWN"),
    regulatoryClass: String(formData.get("regulatoryClass") ?? "UNCLASSIFIED"),
    publishState: String(formData.get("publishState") ?? "DRAFT"),
    lastVerified: optionalText(formData.get("lastVerified"))
      ? new Date(String(formData.get("lastVerified"))).toISOString()
      : null,
  };
}

/**
 * Catalog writes go through the same schema the API uses, then recompute the
 * derived search text and quality score. A record can only be published with a
 * source URL: unsourced specifications never reach the public catalog.
 */
export async function saveProductAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const id = optionalText(formData.get("id"));

  const parsed = adminProductSchema.safeParse(productDataFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = parsed.data;

  const policy = classifyRequest(`${data.productName} ${data.description ?? ""}`);
  if (!policy.allowed) {
    return { error: `Rejected by the content policy: ${policy.message}` };
  }

  if (data.publishState === "PUBLISHED" && !data.sourceUrl) {
    return {
      fieldErrors: { sourceUrl: ["A source URL is required before a record can be published."] },
    };
  }

  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } });
  if (!category) return { fieldErrors: { categorySlug: ["Unknown category."] } };

  const values = {
    manufacturerId: data.manufacturerId,
    manufacturerPartNumber: data.manufacturerPartNumber,
    productName: data.productName,
    categoryId: category.id,
    platform: data.platform ?? null,
    caliber: data.caliber ?? null,
    msrpCents: data.msrpCents ?? null,
    weightGrams: data.weightGrams ?? null,
    lengthMm: data.lengthMm ?? null,
    widthMm: data.widthMm ?? null,
    heightMm: data.heightMm ?? null,
    diameterMm: data.diameterMm ?? null,
    innerDiameterMm: data.innerDiameterMm ?? null,
    material: data.material ?? null,
    finish: data.finish ?? null,
    mountingInterface: data.mountingInterface ?? null,
    threadSpecification: data.threadSpecification ?? null,
    gasSystemCompatibility: data.gasSystemCompatibility ?? null,
    handguardInterface: data.handguardInterface ?? null,
    receiverInterface: data.receiverInterface ?? null,
    opticInterface: data.opticInterface ?? null,
    suppressorCompatibility: data.suppressorCompatibility ?? null,
    barrelCompatibility: data.barrelCompatibility ?? null,
    description: data.description ?? null,
    manufacturerUrl: data.manufacturerUrl ?? null,
    productUrl: data.productUrl ?? null,
    imageUrl: data.imageUrl ?? null,
    technicalDrawingUrl: data.technicalDrawingUrl ?? null,
    manualUrl: data.manualUrl ?? null,
    sourceUrl: data.sourceUrl ?? null,
    verificationStatus: data.verificationStatus,
    availability: data.availability,
    regulatoryClass: data.regulatoryClass,
    publishState: data.publishState,
    lastVerified: data.lastVerified ? new Date(data.lastVerified) : null,
  };

  let productId = id;
  try {
    if (id) {
      const before = await prisma.product.findUnique({ where: { id } });
      await prisma.product.update({ where: { id }, data: values });
      await writeAuditLog({
        actorId: admin.id,
        action: "admin.product.update",
        entityType: "Product",
        entityId: id,
        before: before ? { productName: before.productName, publishState: before.publishState } : null,
        after: { productName: data.productName, publishState: data.publishState },
      });
    } else {
      const created = await prisma.product.create({
        data: {
          ...values,
          slug:
            slugify(`${data.manufacturerPartNumber}-${data.productName}`) ||
            slugify(data.productName),
        } satisfies Prisma.ProductUncheckedCreateInput,
      });
      productId = created.id;
      await writeAuditLog({
        actorId: admin.id,
        action: "admin.product.create",
        entityType: "Product",
        entityId: created.id,
        after: { productName: data.productName },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Another product already uses this manufacturer and part number."
        : "The product could not be saved.";
    return { error: message };
  }

  if (productId) await refreshDerivedProductFields(productId);
  revalidatePath("/admin/products");
  redirect(`/admin/products?saved=${productId ?? ""}`);
}

export async function saveRuleAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();

  let parameters: Record<string, unknown> | null = null;
  const rawParameters = optionalText(formData.get("parameters"));
  if (rawParameters) {
    try {
      parameters = JSON.parse(rawParameters) as Record<string, unknown>;
    } catch {
      return { fieldErrors: { parameters: ["Parameters must be valid JSON."] } };
    }
  }

  const parsed = adminRuleSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? ""),
    subjectCategorySlug: optionalText(formData.get("subjectCategorySlug")),
    targetCategorySlug: optionalText(formData.get("targetCategorySlug")),
    subjectField: optionalText(formData.get("subjectField")),
    targetField: optionalText(formData.get("targetField")),
    parameters,
    result: String(formData.get("result") ?? "UNKNOWN"),
    explanation: String(formData.get("explanation") ?? "").trim(),
    condition: optionalText(formData.get("condition")),
    sourceUrl: optionalText(formData.get("sourceUrl")),
    verificationStatus: String(formData.get("verificationStatus") ?? "UNVERIFIED"),
    priority: Number(formData.get("priority") ?? 100) || 100,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const rule = await prisma.compatibilityRule.create({
    data: {
      ...parsed.data,
      parameters: (parsed.data.parameters ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "admin.rule.create",
    entityType: "CompatibilityRule",
    entityId: rule.id,
    after: { name: rule.name, kind: rule.kind, result: rule.result },
  });

  revalidatePath("/admin/rules");
  redirect("/admin/rules?saved=1");
}

export async function toggleRuleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const rule = await prisma.compatibilityRule.findUnique({ where: { id } });
  if (!rule) return;
  await prisma.compatibilityRule.update({
    where: { id },
    data: { isActive: !rule.isActive },
  });
  await writeAuditLog({
    actorId: admin.id,
    action: rule.isActive ? "admin.rule.deactivate" : "admin.rule.activate",
    entityType: "CompatibilityRule",
    entityId: id,
  });
  revalidatePath("/admin/rules");
}

const importDecisionSchema = z.object({
  recordId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

/**
 * Approve or reject one ingestion record. Approval creates a DRAFT product —
 * never a published one — so a human still has to publish it after review.
 */
export async function reviewImportRecordAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = importDecisionSchema.safeParse({
    recordId: formData.get("recordId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return;

  const record = await prisma.importRecord.findUnique({
    where: { id: parsed.data.recordId },
    include: { batch: { include: { dataSource: true } } },
  });
  if (!record) return;

  if (parsed.data.decision === "reject") {
    await prisma.importRecord.update({
      where: { id: record.id },
      data: {
        state: "REJECTED",
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
      },
    });
    await writeAuditLog({
      actorId: admin.id,
      action: "admin.import.reject",
      entityType: "ImportRecord",
      entityId: record.id,
    });
    revalidatePath("/admin/imports");
    return;
  }

  const normalized = (record.normalized ?? record.rawPayload) as Record<string, unknown>;
  const partNumber = String(normalized.manufacturerPartNumber ?? "").trim();
  const productName = String(normalized.productName ?? "").trim();
  const categorySlug = String(normalized.categorySlug ?? "");
  const rawManufacturer = String(
    (record.rawPayload as Record<string, unknown>).manufacturer ?? "",
  ).trim();

  const manufacturer = await prisma.manufacturer.findFirst({
    where: { name: rawManufacturer },
  });
  const category = await prisma.category.findUnique({ where: { slug: categorySlug } });

  if (!manufacturer || !category || !partNumber || !productName) {
    await prisma.importRecord.update({
      where: { id: record.id },
      data: {
        state: "NEEDS_REVIEW",
        reviewNote:
          "Could not create a product: the record is missing a resolvable manufacturer, category, part number or name.",
      },
    });
    revalidatePath("/admin/imports");
    return;
  }

  const created = await prisma.product.create({
    data: {
      slug: slugify(`${partNumber}-${productName}`),
      manufacturerId: manufacturer.id,
      manufacturerPartNumber: partNumber,
      productName,
      categoryId: category.id,
      lengthMm: numberOrNull(normalized.lengthMm),
      weightGrams: intOrNull(normalized.weightGrams),
      msrpCents: intOrNull(normalized.msrpCents),
      mountingInterface: stringOrNull(normalized.mountingInterface),
      threadSpecification: stringOrNull(normalized.threadSpecification),
      dataSourceId: record.batch.dataSourceId,
      sourceUrl: stringOrNull((record.rawPayload as Record<string, unknown>).source),
      verificationStatus: "SECONDARY_SOURCE",
      // Imports always land as drafts: publishing stays a deliberate human act.
      publishState: "DRAFT",
    },
  });

  await refreshDerivedProductFields(created.id);
  await prisma.importRecord.update({
    where: { id: record.id },
    data: {
      state: "APPROVED",
      reviewedAt: new Date(),
      createdProductId: created.id,
      reviewNote: parsed.data.note ?? null,
    },
  });
  await writeAuditLog({
    actorId: admin.id,
    action: "admin.import.approve",
    entityType: "ImportRecord",
    entityId: record.id,
    after: { createdProductId: created.id },
  });

  revalidatePath("/admin/imports");
  revalidatePath("/admin/products");
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
}

function stringOrNull(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}
