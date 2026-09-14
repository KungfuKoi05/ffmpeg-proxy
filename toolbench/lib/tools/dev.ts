/**
 * Developer utilities. Pure, browser-safe, no dependencies.
 * Every function that can fail returns a result object rather than throwing --
 * these run on user-supplied input, so failure is a normal path, not an
 * exception.
 */

export interface ParseResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  /** 1-indexed position of a syntax error, when the engine reports one. */
  line?: number;
  column?: number;
}

/** Turns V8's "position N" message into a line/column a person can find. */
function locate(input: string, message: string): { line?: number; column?: number } {
  const m = /position (\d+)/.exec(message);
  if (!m) return {};
  const pos = Number(m[1]);
  const before = input.slice(0, pos);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function parseJson(input: string): ParseResult<unknown> {
  if (!input.trim()) return { ok: false, error: "Nothing to parse yet." };
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, error: message, ...locate(input, message) };
  }
}

export function formatJson(input: string, indent: 2 | 4 | 0 = 2): ParseResult<string> {
  const parsed = parseJson(input);
  if (!parsed.ok) return { ok: false, error: parsed.error, line: parsed.line, column: parsed.column };
  return {
    ok: true,
    value: indent === 0
      ? JSON.stringify(parsed.value)
      : JSON.stringify(parsed.value, null, indent),
  };
}

/** Sorts object keys recursively so two JSON blobs can be compared by eye. */
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortJsonKeys(v)]),
    );
  }
  return value;
}

export function jsonStats(value: unknown): { keys: number; depth: number; nodes: number } {
  let keys = 0, nodes = 0, depth = 0;
  const walk = (v: unknown, d: number) => {
    nodes++;
    if (d > depth) depth = d;
    if (Array.isArray(v)) v.forEach((item) => walk(item, d + 1));
    else if (v && typeof v === "object") {
      for (const [, val] of Object.entries(v as Record<string, unknown>)) {
        keys++;
        walk(val, d + 1);
      }
    }
  };
  walk(value, 1);
  return { keys, depth, nodes };
}

/* ------------------------------------------------------------- base64 ---- */

/** UTF-8 safe: btoa alone throws on any non-Latin1 character. */
export function encodeBase64(input: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  const b64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

export function decodeBase64(input: string): ParseResult<string> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Nothing to decode yet." };

  // Accept URL-safe input and restore padding before decoding.
  let normalised = trimmed.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const pad = normalised.length % 4;
  if (pad === 1) return { ok: false, error: "That isn't valid Base64 — the length is wrong." };
  if (pad) normalised += "=".repeat(4 - pad);

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalised)) {
    return { ok: false, error: "That contains characters Base64 never uses." };
  }

  try {
    if (typeof atob === "function") {
      const binary = atob(normalised);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return { ok: true, value: new TextDecoder().decode(bytes) };
    }
    return { ok: true, value: Buffer.from(normalised, "base64").toString("utf8") };
  } catch {
    return { ok: false, error: "That isn't valid Base64." };
  }
}

/* ---------------------------------------------------------------- url ---- */

export function encodeUrl(input: string, component = true): string {
  return component ? encodeURIComponent(input) : encodeURI(input);
}

export function decodeUrl(input: string, component = true): ParseResult<string> {
  try {
    return { ok: true, value: component ? decodeURIComponent(input) : decodeURI(input) };
  } catch {
    return { ok: false, error: "That contains an invalid percent-escape (like %ZZ)." };
  }
}

/* --------------------------------------------------------------- uuid ---- */

/** RFC 4122 v4. Uses crypto when present; the fallback is clearly non-crypto. */
export function generateUuid(rng?: () => number): string {
  if (!rng && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  if (!rng && typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const r = rng ?? Math.random;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const v = Math.floor(r() * 16);
    return (c === "x" ? v : (v & 0x3) | 0x8).toString(16);
  });
}

export function isValidUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input.trim(),
  );
}

/* ---------------------------------------------------------- timestamp ---- */

export interface TimestampView {
  seconds: number;
  milliseconds: number;
  iso: string;
  utc: string;
  relative: string;
}

export function fromUnix(value: number, unit: "s" | "ms" = "s"): ParseResult<TimestampView> {
  const ms = unit === "s" ? value * 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "That isn't a valid timestamp." };
  return {
    ok: true,
    value: {
      seconds: Math.floor(ms / 1000),
      milliseconds: ms,
      iso: date.toISOString(),
      utc: date.toUTCString(),
      relative: relativeTime(ms),
    },
  };
}

export function parseDateString(input: string): ParseResult<TimestampView> {
  const date = new Date(input.trim());
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Couldn't read that as a date." };
  }
  return fromUnix(date.getTime(), "ms");
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [31_536_000_000, "year"], [2_592_000_000, "month"], [604_800_000, "week"],
    [86_400_000, "day"], [3_600_000, "hour"], [60_000, "minute"], [1000, "second"],
  ];
  for (const [size, unit] of units) {
    if (abs >= size) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" })
        .format(Math.round(diff / size), unit);
    }
  }
  return "just now";
}

/* -------------------------------------------------------------- regex ---- */

export interface RegexMatch {
  match: string;
  index: number;
  groups: string[];
  named: Record<string, string>;
}

export interface RegexResult {
  ok: boolean;
  matches: RegexMatch[];
  error?: string;
}

/** Bounded so a catastrophic-backtracking pattern can't hang the tab forever. */
const MAX_MATCHES = 5000;

export function testRegex(pattern: string, flags: string, input: string): RegexResult {
  if (!pattern) return { ok: true, matches: [] };
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (err) {
    return { ok: false, matches: [], error: err instanceof Error ? err.message : "Invalid pattern" };
  }

  const matches: RegexMatch[] = [];
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(input)) !== null) {
    matches.push({
      match: m[0],
      index: m.index,
      groups: m.slice(1).map((g) => g ?? ""),
      named: { ...(m.groups ?? {}) } as Record<string, string>,
    });
    // A zero-length match would loop forever without this nudge.
    if (m[0] === "") re.lastIndex++;
    if (++guard >= MAX_MATCHES) break;
  }
  return { ok: true, matches };
}
