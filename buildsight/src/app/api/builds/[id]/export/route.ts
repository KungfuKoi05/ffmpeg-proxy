import { apiRoute, searchParams, type RouteContext } from "@/lib/api/handler";
import { apiError } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { getBuildForUser, summarizeBuildRecord, toAssemblyInput } from "@/server/builds";
import { entitlements } from "@/lib/plans";
import {
  buildConfigurationJson,
  buildPartsCsv,
  buildSheetPdf,
  type BuildExportInput,
} from "@/lib/export/build-sheet";
import { prisma } from "@/lib/db";

/** GET /api/builds/:id/export?format=pdf|csv|json */
export const GET = apiRoute(async (request, context: RouteContext<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await context.params;
  const format = searchParams(request).get("format") ?? "json";

  const build = await getBuildForUser(id, user.id);
  const summary = await summarizeBuildRecord(build);
  const owner = await prisma.user.findUnique({
    where: { id: build.ownerId },
    select: { name: true },
  });

  const input: BuildExportInput = {
    build: {
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      caliber: build.caliber,
      createdAt: build.createdAt.toISOString(),
      updatedAt: build.updatedAt.toISOString(),
      ownerName: owner?.name ?? null,
    },
    components: toAssemblyInput(build).components,
    summary,
  };

  const filename = build.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "build";

  if (format === "pdf") {
    if (!entitlements(user.plan).pdfExport) {
      return apiError(
        "PLAN_LIMIT",
        "PDF build sheets are a Pro feature. CSV and JSON export are available on every plan.",
        402,
        { limit: "pdfExport" },
      );
    }
    const pdf = buildSheetPdf(input);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}-build-sheet.pdf"`,
      },
    });
  }

  if (format === "csv") {
    return new Response(buildPartsCsv(input), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}-parts.csv"`,
      },
    });
  }

  if (format === "json") {
    return new Response(buildConfigurationJson(input), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}-configuration.json"`,
      },
    });
  }

  return apiError("UNSUPPORTED_FORMAT", "Supported formats are pdf, csv and json.", 400);
});
