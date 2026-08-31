"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { entitlements } from "@/lib/plans";

/** Pin the current comparison so it can be reopened from the dashboard. */
export async function saveComparisonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "Saved comparison";
  const buildIds = String(formData.get("buildIds") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, entitlements(user.plan).compareLimit);

  if (buildIds.length < 2) return;

  const limit = entitlements(user.plan).maxSavedComparisons;
  if (limit !== null) {
    const count = await prisma.savedComparison.count({ where: { ownerId: user.id } });
    if (count >= limit) return;
  }

  // Only the caller's own builds may be referenced.
  const owned = await prisma.build.findMany({
    where: { id: { in: buildIds }, ownerId: user.id },
    select: { id: true },
  });
  if (owned.length < 2) return;

  await prisma.savedComparison.create({
    data: {
      ownerId: user.id,
      name,
      entries: {
        create: owned.map((build, index) => ({ buildId: build.id, sortOrder: index })),
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/compare");
}
