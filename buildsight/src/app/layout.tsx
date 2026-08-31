import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BuildSight — firearm component configuration and visualization",
    template: "%s · BuildSight",
  },
  description:
    "Configure, visualize and verify firearm component configurations from manufacturer-published specifications. Documented compatibility, dimensional clearance, estimated cost and weight.",
  applicationName: "BuildSight",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0c11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-base text-ink antialiased">{children}</body>
    </html>
  );
}
