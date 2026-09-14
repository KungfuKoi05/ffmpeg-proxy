"use client";

import { useMemo, useState } from "react";
import {
  formatJson, parseJson, sortJsonKeys, jsonStats,
  encodeBase64, decodeBase64, encodeUrl, decodeUrl,
  generateUuid, fromUnix, parseDateString, testRegex,
} from "@/lib/tools/dev";
import {
  InOutTool, Select, Toggle, Label, TextArea, Button, CopyButton, Stat,
  ErrorNote, EmptyNote, NumberField, Panel,
} from "@/components/ui";

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<"2" | "4" | "0">("2");
  const [sortKeys, setSortKeys] = useState(false);

  const result = useMemo(() => {
    if (!input.trim()) return { output: "", error: undefined as string | undefined, stats: null };
    const parsed = parseJson(input);
    if (!parsed.ok) {
      const where = parsed.line ? ` (line ${parsed.line}, column ${parsed.column})` : "";
      return { output: "", error: `${parsed.error}${where}`, stats: null };
    }
    const value = sortKeys ? sortJsonKeys(parsed.value) : parsed.value;
    const n = Number(indent) as 0 | 2 | 4;
    return {
      output: n === 0 ? JSON.stringify(value) : JSON.stringify(value, null, n),
      error: undefined,
      stats: jsonStats(parsed.value),
    };
  }, [input, indent, sortKeys]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={result.output} error={result.error}
      downloadName="formatted.json" placeholder='{"paste":"your JSON here"}'
      controls={
        <>
          <div className="w-full sm:w-40">
            <Select id="indent" label="Indent" value={indent}
              onChange={(v) => setIndent(v as typeof indent)}
              options={[
                { value: "2", label: "2 spaces" },
                { value: "4", label: "4 spaces" },
                { value: "0", label: "Minify" },
              ]} />
          </div>
          <Toggle label="Sort keys A→Z" checked={sortKeys} onChange={setSortKeys} />
        </>
      }
      stats={result.stats ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Keys" value={result.stats.keys.toLocaleString()} />
          <Stat label="Nodes" value={result.stats.nodes.toLocaleString()} />
          <Stat label="Max depth" value={String(result.stats.depth)} />
        </div>
      ) : undefined}
    />
  );
}

export function Base64Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [urlSafe, setUrlSafe] = useState(false);

  const result = useMemo(() => {
    if (!input) return { output: "", error: undefined as string | undefined };
    if (mode === "encode") return { output: encodeBase64(input, urlSafe), error: undefined };
    const r = decodeBase64(input);
    return { output: r.ok ? r.value! : "", error: r.ok ? undefined : r.error };
  }, [input, mode, urlSafe]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={result.output} error={result.error}
      downloadName="base64.txt"
      placeholder={mode === "encode" ? "Text to encode…" : "Base64 to decode…"}
      controls={
        <>
          <div className="w-full sm:w-40">
            <Select id="b64-mode" label="Mode" value={mode}
              onChange={(v) => setMode(v as typeof mode)}
              options={[{ value: "encode", label: "Encode" }, { value: "decode", label: "Decode" }]} />
          </div>
          {mode === "encode" ? (
            <Toggle label="URL-safe" checked={urlSafe} onChange={setUrlSafe} />
          ) : null}
        </>
      }
    />
  );
}

export function UrlTool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [component, setComponent] = useState(true);

  const result = useMemo(() => {
    if (!input) return { output: "", error: undefined as string | undefined };
    if (mode === "encode") return { output: encodeUrl(input, component), error: undefined };
    const r = decodeUrl(input, component);
    return { output: r.ok ? r.value! : "", error: r.ok ? undefined : r.error };
  }, [input, mode, component]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={result.output} error={result.error}
      controls={
        <>
          <div className="w-full sm:w-40">
            <Select id="url-mode" label="Mode" value={mode}
              onChange={(v) => setMode(v as typeof mode)}
              options={[{ value: "encode", label: "Encode" }, { value: "decode", label: "Decode" }]} />
          </div>
          <Toggle label="Single component (escapes / ? & =)" checked={component} onChange={setComponent} />
        </>
      }
    />
  );
}

const MAX_UUIDS = 500;

export function UuidGenerator() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [braces, setBraces] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  const generate = () => {
    const n = Math.min(Math.max(1, Math.floor(count) || 1), MAX_UUIDS);
    setIds(Array.from({ length: n }, () => generateUuid()));
  };

  const output = ids
    .map((id) => {
      let v = uppercase ? id.toUpperCase() : id;
      if (braces) v = `{${v}}`;
      return v;
    })
    .join("\n");

  const overLimit = count > MAX_UUIDS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <NumberField id="uuid-count" label="How many" value={count} min={1} max={MAX_UUIDS}
            onChange={setCount} />
        </div>
        <Toggle label="Uppercase" checked={uppercase} onChange={setUppercase} />
        <Toggle label="Wrap in braces" checked={braces} onChange={setBraces} />
        <Button onClick={generate}>Generate</Button>
      </div>
      {overLimit ? (
        <ErrorNote>The free limit is {MAX_UUIDS} per batch. Generate again for more.</ErrorNote>
      ) : null}
      <div>
        <Label htmlFor="uuid-out">Result</Label>
        <TextArea id="uuid-out" rows={10} value={output} readOnly
          className="bg-[var(--surface-2)] font-mono text-[13px]"
          placeholder="Press Generate to create UUIDs." />
      </div>
      <div className="flex gap-2">
        <CopyButton text={output} label="Copy all" />
        <Button variant="ghost" onClick={() => setIds([])} disabled={!ids.length}>Clear</Button>
      </div>
      {!ids.length ? <EmptyNote>Generated with your browser&apos;s crypto API — never sent anywhere.</EmptyNote> : null}
    </div>
  );
}

export function TimestampConverter() {
  const [raw, setRaw] = useState("");
  const [unit, setUnit] = useState<"s" | "ms">("s");
  const [now, setNow] = useState<number | null>(null);

  const result = useMemo(() => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // A bare number is a timestamp; anything else is treated as a date string.
    if (/^-?\d+$/.test(trimmed)) return fromUnix(Number(trimmed), unit);
    return parseDateString(trimmed);
  }, [raw, unit]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80">
          <Label htmlFor="ts">Timestamp or date</Label>
          <input id="ts" value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder="1767225600 or 2026-01-01"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-[14px] outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="w-32">
          <Select id="unit" label="Unit" value={unit} onChange={(v) => setUnit(v as typeof unit)}
            options={[{ value: "s", label: "Seconds" }, { value: "ms", label: "Milliseconds" }]} />
        </div>
        <Button variant="ghost" onClick={() => { const t = Date.now(); setNow(t); setRaw(String(unit === "s" ? Math.floor(t / 1000) : t)); }}>
          Use now
        </Button>
      </div>

      {result && !result.ok ? <ErrorNote>{result.error}</ErrorNote> : null}

      {result?.ok ? (
        <Panel className="divide-y divide-[var(--line-2)]">
          {[
            ["Unix seconds", String(result.value!.seconds)],
            ["Unix milliseconds", String(result.value!.milliseconds)],
            ["ISO 8601", result.value!.iso],
            ["UTC", result.value!.utc],
            ["Relative", result.value!.relative],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[13px] text-[var(--ink-2)]">{k}</span>
              <span className="flex items-center gap-2">
                <code className="font-mono text-[13px]">{v}</code>
                <CopyButton text={v} label="Copy" />
              </span>
            </div>
          ))}
        </Panel>
      ) : null}

      {!raw ? <EmptyNote>Enter a Unix timestamp or a date and every format appears at once.{now ? "" : ""}</EmptyNote> : null}
    </div>
  );
}

const FLAGS = ["g", "i", "m", "s", "u"] as const;

export function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<string[]>(["g"]);
  const [text, setText] = useState("");

  const result = useMemo(
    () => testRegex(pattern, flags.join(""), text),
    [pattern, flags, text],
  );

  const toggleFlag = (f: string) =>
    setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="pattern">Regular expression</Label>
        <div className="flex items-center gap-2">
          <span className="text-[var(--ink-3)]">/</span>
          <input id="pattern" value={pattern} onChange={(e) => setPattern(e.target.value)}
            placeholder="\\d{3}-\\d{4}"
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-[14px] outline-none focus:border-[var(--accent)]" />
          <span className="text-[var(--ink-3)]">/</span>
          <div className="flex gap-1">
            {FLAGS.map((f) => (
              <button key={f} onClick={() => toggleFlag(f)}
                aria-pressed={flags.includes(f)}
                className={`h-9 w-8 rounded-lg border font-mono text-[13px] ${
                  flags.includes(f)
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "border-[var(--line)] text-[var(--ink-3)]"
                }`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="regex-text">Test against</Label>
        <TextArea id="regex-text" rows={8} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text to search…" />
      </div>

      {result.error ? <ErrorNote>{result.error}</ErrorNote> : null}

      {!result.error && pattern ? (
        <>
          <EmptyNote>
            {result.matches.length === 0
              ? "No matches."
              : `${result.matches.length} match${result.matches.length === 1 ? "" : "es"}.`}
          </EmptyNote>
          {result.matches.length > 0 ? (
            <Panel className="max-h-72 overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                  <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Match</th>
                    <th className="px-3 py-2">At</th><th className="px-3 py-2">Groups</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-2)]">
                  {result.matches.slice(0, 200).map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 tabular-nums text-[var(--ink-3)]">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono">{m.match || <em className="text-[var(--ink-3)]">empty</em>}</td>
                      <td className="px-3 py-1.5 tabular-nums text-[var(--ink-3)]">{m.index}</td>
                      <td className="px-3 py-1.5 font-mono text-[var(--ink-2)]">{m.groups.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
