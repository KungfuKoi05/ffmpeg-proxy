"use client";

/**
 * Privacy-conscious analytics.
 *
 * Rules this enforces, not just documents:
 *  - No cookies, no localStorage identifier, no cross-site tracking.
 *  - The session id is random per tab and dies with it.
 *  - Nothing a user pastes or converts is ever included in an event. Events
 *    carry the tool slug and outcome, never content, filenames or sizes of
 *    identifiable material.
 *  - Events are batched and sent with sendBeacon so they never delay the tool.
 */
export type EventName =
  | "page_view" | "tool_view" | "tool_used"
  | "conversion_started" | "conversion_success" | "conversion_failed"
  | "download_completed" | "copy_completed"
  | "limit_reached" | "upgrade_viewed" | "checkout_started";

export interface AnalyticsEvent {
  name: EventName;
  tool?: string;
  /** Small, non-identifying facts only: mode, outcome, duration bucket. */
  props?: Record<string, string | number | boolean>;
  ts: number;
}

const QUEUE: AnalyticsEvent[] = [];
const MAX_BATCH = 20;
const FLUSH_MS = 4000;
let timer: ReturnType<typeof setTimeout> | null = null;
let sessionId: string | null = null;

/** Per-tab, in-memory only. Not persisted, so it cannot follow anyone. */
function getSessionId(): string {
  if (!sessionId) {
    sessionId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  return sessionId;
}

/** Content must never reach analytics. This is the guard that keeps it out. */
const BANNED_PROP_KEYS = /text|content|value|input|output|body|email|url|file|name/i;

function sanitize(props?: Record<string, string | number | boolean>) {
  if (!props) return undefined;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (BANNED_PROP_KEYS.test(k)) continue;
    clean[k] = typeof v === "string" ? v.slice(0, 64) : v;
  }
  return Object.keys(clean).length ? clean : undefined;
}

export function track(name: EventName, props?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  const tool = typeof props?.tool === "string" ? props.tool : undefined;
  const rest = { ...props };
  delete rest.tool;

  QUEUE.push({ name, tool, props: sanitize(rest), ts: Date.now() });

  if (QUEUE.length >= MAX_BATCH) { flush(); return; }
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export function flush(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!QUEUE.length || typeof window === "undefined") return;

  const batch = QUEUE.splice(0, QUEUE.length);
  const payload = JSON.stringify({
    session: getSessionId(),
    path: window.location.pathname,
    referrer: document.referrer ? new URL(document.referrer).hostname : "",
    events: batch,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/events", {
        method: "POST", body: payload, keepalive: true,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // Analytics failing must never surface to a user or break a tool.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
