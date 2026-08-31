import { prisma } from "@/lib/db";
import { entitlements, PlanLimitError } from "@/lib/plans";
import { summarizeBuild, type BuildSummary } from "@/lib/build/summary";
import { loadActiveRules } from "@/server/rules";
import { productInclude, toProductFacts, type ProductWithRelations } from "@/server/products";
import { NotFoundError } from "@/lib/api/response";
import { slotForCategory } from "@/lib/assembly/slots";
import type { AssemblyComponent, AssemblyInput } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const buildInclude = {
  components: {
    include: { product: { include: productInclude } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.BuildInclude;

export type BuildWithComponents = Prisma.BuildGetPayload<{ include: typeof buildInclude }>;

export function toAssemblyInput(build: BuildWithComponents): AssemblyInput {
  const components: AssemblyComponent[] = build.components.map((component) => ({
    slotKey: component.slotKey,
    quantity: component.quantity,
    product: toProductFacts(component.product as ProductWithRelations),
  }));
  return { platform: build.platform, components };
}

export async function getBuildForUser(
  buildId: string,
  userId: string,
): Promise<BuildWithComponents> {
  const build = await prisma.build.findUnique({ where: { id: buildId }, include: buildInclude });
  if (!build) throw new NotFoundError("Build not found.");
  if (build.ownerId !== userId && !build.isPublic) {
    throw new NotFoundError("Build not found.");
  }
  return build;
}

export async function summarizeBuildRecord(build: BuildWithComponents): Promise<BuildSummary> {
  const rules = await loadActiveRules();
  return summarizeBuild(toAssemblyInput(build), rules);
}

export async function listBuilds(userId: string, includeArchived = false) {
  return prisma.build.findMany({
    where: { ownerId: userId, ...(includeArchived ? {} : { isArchived: false }) },
    include: buildInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function assertBuildQuota(userId: string, plan: Parameters<typeof entitlements>[0]) {
  const limit = entitlements(plan).maxBuilds;
  if (limit === null) return;
  const count = await prisma.build.count({ where: { ownerId: userId, isArchived: false } });
  if (count >= limit) {
    throw new PlanLimitError(
      `Your plan includes ${limit} saved builds. Archive one or upgrade to save more.`,
      "maxBuilds",
    );
  }
}

export interface CreateBuildInput {
  name: string;
  description?: string | null;
  platform?: string | null;
  caliber?: string | null;
  components?: Array<{ productId: string; slotKey?: string; quantity?: number }>;
}

export async function createBuild(userId: string, input: CreateBuildInput) {
  const componentData = await resolveComponents(input.components ?? []);
  return prisma.build.create({
    data: {
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      platform: input.platform ?? null,
      caliber: input.caliber ?? null,
      components: { create: componentData },
    },
    include: buildInclude,
  });
}

/** Resolve product ids to slots and capture the price at the time of adding. */
async function resolveComponents(
  components: Array<{ productId: string; slotKey?: string; quantity?: number }>,
) {
  if (components.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: components.map((c) => c.productId) } },
    include: productInclude,
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return components.flatMap((component) => {
    const product = byId.get(component.productId);
    if (!product) return [];
    const facts = toProductFacts(product);
    const slotKey = component.slotKey ?? slotForCategory(product.category.slug)?.key;
    if (!slotKey) return [];
    return [
      {
        productId: product.id,
        slotKey,
        quantity: Math.max(1, component.quantity ?? 1),
        priceSnapshotCents: facts.currentPriceCents ?? facts.msrpCents ?? null,
      },
    ];
  });
}

export async function addComponent(
  buildId: string,
  userId: string,
  input: { productId: string; slotKey?: string; quantity?: number },
) {
  const build = await getOwnedBuild(buildId, userId);
  const [data] = await resolveComponents([input]);
  if (!data) throw new NotFoundError("Product not found, or its category has no assembly slot.");

  // Replacing a component in a single-occupancy slot is the common action in
  // the Build Studio, so swap rather than reject.
  const slot = data.slotKey;
  const existing = await prisma.buildComponent.findMany({ where: { buildId, slotKey: slot } });
  const maxPerSlot = slot === "accessory" || slot === "sling-hardware" || slot === "light" ? 4 : 1;
  if (existing.length >= maxPerSlot) {
    await prisma.buildComponent.deleteMany({
      where: { id: { in: existing.slice(0, existing.length - maxPerSlot + 1).map((c) => c.id) } },
    });
  }

  await prisma.buildComponent.upsert({
    where: {
      buildId_slotKey_productId: { buildId, slotKey: slot, productId: data.productId },
    },
    create: { ...data, buildId },
    update: { quantity: data.quantity },
  });
  await prisma.build.update({ where: { id: buildId }, data: { updatedAt: new Date() } });
  return getBuildForUser(build.id, userId);
}

export async function removeComponent(buildId: string, userId: string, componentId: string) {
  await getOwnedBuild(buildId, userId);
  await prisma.buildComponent.deleteMany({ where: { id: componentId, buildId } });
  await prisma.build.update({ where: { id: buildId }, data: { updatedAt: new Date() } });
  return getBuildForUser(buildId, userId);
}

export async function getOwnedBuild(buildId: string, userId: string) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build || build.ownerId !== userId) throw new NotFoundError("Build not found.");
  return build;
}

export async function duplicateBuild(buildId: string, userId: string) {
  const build = await getBuildForUser(buildId, userId);
  return prisma.build.create({
    data: {
      ownerId: userId,
      name: `${build.name} (copy)`,
      description: build.description,
      platform: build.platform,
      caliber: build.caliber,
      components: {
        create: build.components.map((component) => ({
          productId: component.productId,
          slotKey: component.slotKey,
          quantity: component.quantity,
          priceSnapshotCents: component.priceSnapshotCents,
          notes: component.notes,
        })),
      },
    },
    include: buildInclude,
  });
}
