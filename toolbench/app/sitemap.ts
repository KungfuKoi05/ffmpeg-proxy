import type { MetadataRoute } from "next";
import { LIVE_TOOLS, categoryList } from "@/lib/tools/registry";
import { canonical } from "@/lib/site";

/** Generated from the registry, so it can never drift from what exists. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: canonical("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: canonical("/tools"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: canonical("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...categoryList().map((c) => ({
      url: canonical(`/tools/${c.slug}`),
      lastModified: now, changeFrequency: "weekly" as const, priority: 0.8,
    })),
    ...LIVE_TOOLS.map((t) => ({
      url: canonical(`/${t.slug}`),
      lastModified: now, changeFrequency: "monthly" as const, priority: 0.7,
    })),
  ];
}
