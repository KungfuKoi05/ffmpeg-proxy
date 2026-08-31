import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuildForUser, toAssemblyInput } from "@/server/builds";
import { BuildStudio } from "@/components/studio/build-studio";
import { loadStudioData } from "@/server/studio";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ buildId: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: "Build Studio" };
  try {
    const { buildId } = await params;
    const build = await getBuildForUser(buildId, user.id);
    return { title: build.name };
  } catch {
    return { title: "Build Studio" };
  }
}

export default async function StudioBuildPage({
  params,
}: {
  params: Promise<{ buildId: string }>;
}) {
  const user = await getCurrentUser();
  const { buildId } = await params;
  if (!user) redirect(`/sign-in?next=/studio/${buildId}`);

  let build;
  try {
    build = await getBuildForUser(buildId, user.id);
  } catch {
    notFound();
  }

  const data = await loadStudioData();
  const assembly = toAssemblyInput(build);

  return (
    <BuildStudio
      build={{
        id: build.id,
        name: build.name,
        description: build.description,
        platform: build.platform,
        caliber: build.caliber,
      }}
      initialComponents={assembly.components}
      rules={data.rules}
      catalog={data.catalog}
      categories={data.categories}
      canSave
    />
  );
}
