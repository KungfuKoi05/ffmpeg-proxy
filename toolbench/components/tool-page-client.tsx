"use client";

import { useEffect } from "react";
import { ToolRenderer } from "@/components/tools";
import { track } from "@/lib/analytics";

/** Records the view once, then hands off to the tool itself. */
export function ToolPageClient({ slug }: { slug: string }) {
  useEffect(() => {
    track("page_view");
    track("tool_view", { tool: slug });
  }, [slug]);

  return <ToolRenderer slug={slug} />;
}
