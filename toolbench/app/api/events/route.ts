import { NextResponse } from "next/server";
import { storeEvents, type StoredEvent } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32_000;
const MAX_EVENTS = 50;
const ALLOWED = new Set([
  "page_view", "tool_view", "tool_used",
  "conversion_started", "conversion_success", "conversion_failed",
  "download_completed", "copy_completed",
  "limit_reached", "upgrade_viewed", "checkout_started",
]);

/** Naive per-instance limiter. Enough to stop a stuck loop flooding ingest. */
const hits = new Map<string, { n: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const b = hits.get(key);
  if (!b || b.resetAt <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { n: 1, resetAt: now + 60_000 });
    return false;
  }
  b.n++;
  return b.n > 120;
}

/**
 * Analytics ingest. Deliberately strict: it accepts a small, known set of event
 * names and drops everything else, so a malicious or buggy client cannot use
 * this endpoint as free storage or smuggle user content into our logs.
 */
export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const { session, path, referrer, events } = (body ?? {}) as {
      session?: unknown; path?: unknown; referrer?: unknown; events?: unknown;
    };

    if (typeof session !== "string" || !Array.isArray(events)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const clean: StoredEvent[] = [];
    for (const e of events.slice(0, MAX_EVENTS)) {
      const ev = e as { name?: unknown; tool?: unknown; props?: unknown; ts?: unknown };
      if (typeof ev.name !== "string" || !ALLOWED.has(ev.name)) continue;
      clean.push({
        name: ev.name,
        tool: typeof ev.tool === "string" ? ev.tool.slice(0, 64) : undefined,
        path: typeof path === "string" ? path.slice(0, 128) : "",
        referrer: typeof referrer === "string" ? referrer.slice(0, 128) : "",
        session: session.slice(0, 64),
        props: ev.props && typeof ev.props === "object" ? (ev.props as Record<string, unknown>) : undefined,
        ts: typeof ev.ts === "number" ? ev.ts : Date.now(),
      });
    }

    if (clean.length) await storeEvents(clean);

    // 204 keeps sendBeacon quiet and costs nothing to return.
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
