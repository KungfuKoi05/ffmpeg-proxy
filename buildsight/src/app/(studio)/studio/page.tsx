import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { BuildStudio } from "@/components/studio/build-studio";
import { loadStudioData } from "@/server/studio";

export const metadata: Metadata = { title: "Build Studio" };

/**
 * The studio in sandbox mode: a configuration that lives in the browser until
 * it is saved. Signed-out visitors get the full engine experience and are
 * prompted to create an account only when they want to keep the result.
 */
export default async function StudioSandboxPage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadStudioData()]);

  return (
    <BuildStudio
      build={{
        id: null,
        name: "Untitled configuration",
        description: null,
        platform: "ar15",
        caliber: null,
      }}
      initialComponents={[]}
      rules={data.rules}
      catalog={data.catalog}
      categories={data.categories}
      canSave={Boolean(user)}
    />
  );
}
