/** Site-wide constants. One place to change the brand or the canonical host. */
export const SITE = {
  name: "Toolbench",
  tagline: "Free tools for files, PDFs, images, text, business and more.",
  /** Override per environment; used for canonicals, sitemap and OpenGraph. */
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://toolbench.app",
  description:
    "A growing set of free, fast utilities that run entirely in your browser. No uploads, no signup, no tracking of what you process.",
} as const;

export function canonical(path = "/"): string {
  return new URL(path, SITE.url).toString();
}
