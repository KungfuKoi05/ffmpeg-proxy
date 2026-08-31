import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "API" };

const ENDPOINTS: Array<{
  method: string;
  path: string;
  description: string;
  auth?: string;
}> = [
  { method: "GET", path: "/api/products", description: "Filtered, paginated catalog search." },
  { method: "GET", path: "/api/products/:id", description: "One product by id or slug, with specifications, prices and quality issues." },
  { method: "GET", path: "/api/manufacturers", description: "Manufacturers with published product counts." },
  { method: "GET", path: "/api/categories", description: "Category tree with the assembly slot each maps to." },
  { method: "GET", path: "/api/search", description: "Unified product and manufacturer search." },
  { method: "POST", path: "/api/compatibility", description: "Evaluate a component set against the rules engine." },
  { method: "POST", path: "/api/dimensions", description: "Clearance and overall-length report for a component set." },
  { method: "GET", path: "/api/prices", description: "Observed price history, windowed by plan." },
  { method: "GET", path: "/api/builds", description: "The signed-in user's configurations with summaries.", auth: "session" },
  { method: "POST", path: "/api/builds", description: "Create a configuration.", auth: "session" },
  { method: "GET", path: "/api/builds/:id", description: "One configuration with its recomputed summary.", auth: "session" },
  { method: "PUT", path: "/api/builds/:id", description: "Rename, describe, archive or publish.", auth: "session" },
  { method: "DELETE", path: "/api/builds/:id", description: "Delete a configuration.", auth: "session" },
  { method: "POST", path: "/api/builds/:id/components", description: "Add or replace a component in a slot.", auth: "session" },
  { method: "DELETE", path: "/api/builds/:id/components/:componentId", description: "Remove a component.", auth: "session" },
  { method: "POST", path: "/api/builds/:id/duplicate", description: "Duplicate a configuration.", auth: "session" },
  { method: "GET", path: "/api/builds/:id/export?format=pdf|csv|json", description: "Build sheet, parts list or configuration export.", auth: "session" },
  { method: "GET", path: "/api/watchlist", description: "Watched components with target prices.", auth: "session" },
  { method: "POST", path: "/api/watchlist", description: "Watch a component or update its target price.", auth: "session" },
  { method: "DELETE", path: "/api/watchlist/:productId", description: "Stop watching a component.", auth: "session" },
  { method: "POST", path: "/api/scope", description: "Assistant: parses a request into filters and searches the catalog." },
  { method: "POST", path: "/api/admin/products", description: "Create a catalog product.", auth: "admin" },
  { method: "PUT", path: "/api/admin/products/:id", description: "Update a catalog product.", auth: "admin" },
  { method: "POST", path: "/api/admin/rules", description: "Author a compatibility rule.", auth: "admin" },
  { method: "POST", path: "/api/admin/import/:batchId/records/:recordId", description: "Approve or reject an ingestion record.", auth: "admin" },
];

const METHOD_TONE: Record<string, "green" | "accent" | "yellow" | "red"> = {
  GET: "green",
  POST: "accent",
  PUT: "yellow",
  DELETE: "red",
};

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">API</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Every endpoint validates its input with a schema, applies rate limiting, and rejects
          cross-origin mutations. Errors return a stable{" "}
          <code className="rounded bg-elevated px-1 py-0.5 font-mono text-[11px] text-ink">
            {`{ error: { code, message } }`}
          </code>{" "}
          shape. Authentication is a signed, httpOnly session cookie.
        </p>
      </header>

      <Card>
        <CardContent className="divide-y divide-line p-0">
          {ENDPOINTS.map((endpoint) => (
            <div key={`${endpoint.method}-${endpoint.path}`} className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
              <Badge tone={METHOD_TONE[endpoint.method]}>{endpoint.method}</Badge>
              <code className="font-mono text-xs text-ink">{endpoint.path}</code>
              {endpoint.auth ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {endpoint.auth}
                </span>
              ) : null}
              <span className="w-full text-xs text-ink-muted sm:w-auto sm:flex-1">
                {endpoint.description}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
