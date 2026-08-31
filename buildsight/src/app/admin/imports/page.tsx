import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { reviewImportRecordAction } from "@/server/actions/admin";
import { formatRelative } from "@/lib/utils";
import type { DataQualityIssue } from "@/lib/quality/data-quality";

export const metadata: Metadata = { title: "Ingestion · Admin" };

const STATE_TONE: Record<string, "green" | "yellow" | "red" | "gray" | "neutral"> = {
  APPROVED: "green",
  NEEDS_REVIEW: "yellow",
  PENDING: "yellow",
  DUPLICATE: "red",
  REJECTED: "gray",
};

export default async function AdminImportsPage() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      dataSource: { select: { name: true, kind: true } },
      records: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Ingestion</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          The workflow is import → normalise → detect duplicates → validate units → assign a
          verification level → flag missing specifications → human approval. Approving a record
          creates a <strong className="text-ink">draft</strong> product; publishing stays a separate,
          deliberate step.
        </p>
      </header>

      {batches.length === 0 ? (
        <EmptyState
          title="No import batches"
          description="Batches created through the ingestion API appear here for review."
        />
      ) : (
        batches.map((batch) => (
          <Card key={batch.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{batch.name}</CardTitle>
                <Badge tone="neutral">{batch.state.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {batch.dataSource?.name ?? "No data source"} · {batch.records.length} record
                {batch.records.length === 1 ? "" : "s"} · created {formatRelative(batch.createdAt)}
              </p>
              {batch.notes ? (
                <p className="mt-1 text-xs text-ink-faint">{batch.notes}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {batch.records.map((record) => {
                const issues = (record.issues as DataQualityIssue[] | null) ?? [];
                const normalized = (record.normalized ?? {}) as Record<string, unknown>;
                const raw = record.rawPayload as Record<string, unknown>;
                const decided = record.state === "APPROVED" || record.state === "REJECTED";

                return (
                  <div key={record.id} className="rounded border border-line bg-elevated p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink">
                          {String(normalized.productName ?? raw.name ?? "Untitled record")}
                        </p>
                        <p className="font-mono text-[11px] text-ink-muted">
                          {String(normalized.manufacturerPartNumber ?? raw.part_number ?? "—")} ·{" "}
                          {String(raw.manufacturer ?? "unknown manufacturer")}
                        </p>
                      </div>
                      <Badge tone={STATE_TONE[record.state] ?? "neutral"}>
                        {record.state.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="label-micro">Raw payload</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-base p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                          {JSON.stringify(raw, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="label-micro">Normalised</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-base p-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                          {record.normalized
                            ? JSON.stringify(normalized, null, 2)
                            : "Not normalised — the record could not be mapped."}
                        </pre>
                      </div>
                    </div>

                    {issues.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {issues.map((issue) => (
                          <li key={`${issue.code}-${issue.field}`} className="text-[11px]">
                            <span
                              className={
                                issue.severity === "ERROR"
                                  ? "text-signal-red"
                                  : issue.severity === "WARNING"
                                    ? "text-signal-yellow"
                                    : "text-ink-faint"
                              }
                            >
                              {issue.severity}
                            </span>{" "}
                            <span className="text-ink-muted">{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {record.reviewNote ? (
                      <p className="mt-2 text-[11px] text-ink-faint">Note: {record.reviewNote}</p>
                    ) : null}

                    {!decided ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={reviewImportRecordAction}>
                          <input type="hidden" name="recordId" value={record.id} />
                          <input type="hidden" name="decision" value="approve" />
                          <Button type="submit" size="sm" variant="primary">
                            Approve as draft
                          </Button>
                        </form>
                        <form action={reviewImportRecordAction}>
                          <input type="hidden" name="recordId" value={record.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <Button type="submit" size="sm" variant="ghost">
                            Reject
                          </Button>
                        </form>
                      </div>
                    ) : record.createdProductId ? (
                      <a
                        href={`/admin/products/${record.createdProductId}`}
                        className="mt-3 inline-block text-[11px] text-accent hover:underline"
                      >
                        Open the created draft
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
