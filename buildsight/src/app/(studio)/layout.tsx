import { SiteHeader } from "@/components/layout/site-header";

/** The studio fills the viewport: header only, no page scroll, no footer. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
