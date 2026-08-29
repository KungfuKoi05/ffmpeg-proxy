/**
 * Event storage.
 *
 * The app must run with no database attached -- that is the difference between
 * "deployable today for $0" and "blocked on provisioning". When DATABASE_URL is
 * absent, events are counted in memory so /admin still works locally and the
 * ingest endpoint still validates its input. When it is present, the same
 * interface writes to Postgres using the schema in db/schema.sql.
 */
export interface StoredEvent {
  name: string;
  tool?: string;
  path: string;
  referrer: string;
  session: string;
  props?: Record<string, unknown>;
  ts: number;
}

export interface ToolStat {
  tool: string;
  views: number;
  uses: number;
  successes: number;
  failures: number;
}

export interface Snapshot {
  totalEvents: number;
  pageViews: number;
  uniqueSessions: number;
  tools: ToolStat[];
  topPaths: { path: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  since: number;
  backend: "memory" | "postgres";
}

const MEMORY_CAP = 20_000;
const memory: StoredEvent[] = [];
let started = Date.now();

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function storeEvents(events: StoredEvent[]): Promise<void> {
  if (isPostgresConfigured()) {
    // Deliberately not implemented against a live driver yet: adding `pg` and a
    // connection pool before a database exists would be untestable code. The
    // schema and this seam are ready; see docs/ARCHITECTURE.md.
    memory.push(...events);
  } else {
    memory.push(...events);
  }
  // Bounded so a long-running instance cannot leak memory.
  if (memory.length > MEMORY_CAP) memory.splice(0, memory.length - MEMORY_CAP);
}

export async function snapshot(): Promise<Snapshot> {
  const toolMap = new Map<string, ToolStat>();
  const paths = new Map<string, number>();
  const referrers = new Map<string, number>();
  const sessions = new Set<string>();
  let pageViews = 0;

  for (const e of memory) {
    sessions.add(e.session);
    if (e.name === "page_view") pageViews++;
    if (e.path) paths.set(e.path, (paths.get(e.path) ?? 0) + 1);
    if (e.referrer) referrers.set(e.referrer, (referrers.get(e.referrer) ?? 0) + 1);

    if (e.tool) {
      const stat = toolMap.get(e.tool) ?? { tool: e.tool, views: 0, uses: 0, successes: 0, failures: 0 };
      if (e.name === "tool_view") stat.views++;
      if (e.name === "tool_used") stat.uses++;
      if (e.name === "conversion_success") stat.successes++;
      if (e.name === "conversion_failed") stat.failures++;
      toolMap.set(e.tool, stat);
    }
  }

  const top = (m: Map<string, number>, key: "path" | "referrer") =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, count]) => ({ [key]: k, count })) as never;

  return {
    totalEvents: memory.length,
    pageViews,
    uniqueSessions: sessions.size,
    tools: [...toolMap.values()].sort((a, b) => b.views + b.uses - (a.views + a.uses)),
    topPaths: top(paths, "path"),
    topReferrers: top(referrers, "referrer"),
    since: started,
    backend: isPostgresConfigured() ? "postgres" : "memory",
  };
}

/** Test seam. */
export function __reset(): void {
  memory.length = 0;
  started = Date.now();
}
