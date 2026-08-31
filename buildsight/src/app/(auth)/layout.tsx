import Link from "next/link";
import { BuildSightMark } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="tech-grid absolute inset-0 opacity-30" aria-hidden />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <BuildSightMark />
          <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em]">
            BuildSight
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
