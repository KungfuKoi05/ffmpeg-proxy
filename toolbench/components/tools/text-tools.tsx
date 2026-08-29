"use client";

import { useMemo, useState } from "react";
import {
  analyzeText, convertCase, removeDuplicateLines, removeEmptyLines, removeExtraSpaces,
  sortLines, reverseText, findReplace, extractEmails, extractUrls,
  type CaseMode, type SortMode,
} from "@/lib/tools/text";
import {
  InOutTool, Stat, Select, Toggle, Label, TextArea, CopyButton, Button, EmptyNote,
} from "@/components/ui";
import { track } from "@/lib/analytics";

const SAMPLE_HINT = "Paste your text here…";

export function WordCounter() {
  const [input, setInput] = useState("");
  const s = useMemo(() => analyzeText(input), [input]);
  const mins = (m: number) => (m < 1 ? `${Math.max(1, Math.round(m * 60))} sec` : `${Math.round(m)} min`);

  return (
    <div className="space-y-3">
      <Label htmlFor="wc">Your text</Label>
      <TextArea id="wc" rows={12} value={input} placeholder={SAMPLE_HINT}
        onChange={(e) => { setInput(e.target.value); track("tool_used", { tool: "word-counter" }); }} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Words" value={s.words.toLocaleString()} />
        <Stat label="Characters" value={s.characters.toLocaleString()} />
        <Stat label="Sentences" value={s.sentences.toLocaleString()} />
        <Stat label="Paragraphs" value={s.paragraphs.toLocaleString()} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="No spaces" value={s.charactersNoSpaces.toLocaleString()} />
        <Stat label="Lines" value={s.lines.toLocaleString()} />
        <Stat label="Reading" value={mins(s.readingMinutes)} hint="at 238 wpm" />
        <Stat label="Speaking" value={mins(s.speakingMinutes)} hint="at 140 wpm" />
      </div>
      {!input ? <EmptyNote>Start typing or paste text — counts update as you go.</EmptyNote> : null}
    </div>
  );
}

const PLATFORM_LIMITS = [
  { name: "SMS segment", limit: 160 },
  { name: "X / Twitter post", limit: 280 },
  { name: "Meta description", limit: 160 },
  { name: "Title tag", limit: 60 },
];

export function CharacterCounter() {
  const [input, setInput] = useState("");
  const s = useMemo(() => analyzeText(input), [input]);

  return (
    <div className="space-y-3">
      <Label htmlFor="cc">Your text</Label>
      <TextArea id="cc" rows={10} value={input} placeholder={SAMPLE_HINT}
        onChange={(e) => setInput(e.target.value)} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Characters" value={s.characters.toLocaleString()} />
        <Stat label="Without spaces" value={s.charactersNoSpaces.toLocaleString()} />
        <Stat label="Words" value={s.words.toLocaleString()} />
        <Stat label="Lines" value={s.lines.toLocaleString()} />
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="mb-2 text-[13px] font-semibold">Against common limits</h2>
        <ul className="space-y-2">
          {PLATFORM_LIMITS.map((p) => {
            const over = s.characters > p.limit;
            const pct = Math.min(100, (s.characters / p.limit) * 100);
            return (
              <li key={p.name}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--ink-2)]">{p.name}</span>
                  <span className={`tabular-nums ${over ? "text-[var(--crit)]" : "text-[var(--ink-2)]"}`}>
                    {s.characters} / {p.limit}{over ? ` (${s.characters - p.limit} over)` : ""}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]">
                  <div className="h-1.5 rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: over ? "var(--crit)" : "var(--accent)" }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const CASE_MODES: { value: CaseMode; label: string }[] = [
  { value: "upper", label: "UPPERCASE" },
  { value: "lower", label: "lowercase" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "camel", label: "camelCase" },
  { value: "snake", label: "snake_case" },
  { value: "kebab", label: "kebab-case" },
  { value: "toggle", label: "tOGGLE cASE" },
];

export function CaseConverter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CaseMode>("title");
  const output = useMemo(() => convertCase(input, mode), [input, mode]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={output} downloadName="converted.txt"
      controls={
        <div className="w-full sm:w-64">
          <Select id="case-mode" label="Convert to" value={mode}
            onChange={(v) => setMode(v as CaseMode)} options={CASE_MODES} />
        </div>
      }
    />
  );
}

type LineMode = "dedupe" | "empty" | "spaces";

export function LineCleaner({ mode }: { mode: LineMode }) {
  const [input, setInput] = useState("");
  const [trim, setTrim] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(true);

  const output = useMemo(() => {
    if (mode === "dedupe") return removeDuplicateLines(input, { trimEach: trim, caseSensitive });
    if (mode === "empty") return removeEmptyLines(input);
    return removeExtraSpaces(input);
  }, [input, mode, trim, caseSensitive]);

  const before = input ? input.split(/\r\n|\r|\n/).length : 0;
  const after = output ? output.split(/\r\n|\r|\n/).length : 0;

  return (
    <InOutTool
      input={input} setInput={setInput} output={output} downloadName="cleaned.txt"
      placeholder="Paste your list here…"
      controls={mode === "dedupe" ? (
        <div className="flex flex-wrap gap-4">
          <Toggle label="Trim each line first" checked={trim} onChange={setTrim} />
          <Toggle label="Case sensitive" checked={caseSensitive} onChange={setCaseSensitive} />
        </div>
      ) : undefined}
      stats={input ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Lines in" value={before.toLocaleString()} />
          <Stat label="Lines out" value={after.toLocaleString()} />
          <Stat label="Removed" value={Math.max(0, before - after).toLocaleString()} />
        </div>
      ) : undefined}
    />
  );
}

const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: "alpha", label: "A → Z" },
  { value: "alpha-desc", label: "Z → A" },
  { value: "numeric", label: "Numerically" },
  { value: "length", label: "Shortest first" },
  { value: "length-desc", label: "Longest first" },
  { value: "shuffle", label: "Shuffle" },
];

export function LineSorter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SortMode>("alpha");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [seed, setSeed] = useState(0);

  // A seeded generator makes `seed` a real dependency rather than a lint-
  // silencing trick, and makes each shuffle reproducible while it is on screen.
  const output = useMemo(() => {
    if (mode !== "shuffle") return sortLines(input, mode, { caseSensitive });
    let state = seed * 2654435761 + 1;
    const rng = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    return sortLines(input, mode, { caseSensitive, random: rng });
  }, [input, mode, caseSensitive, seed]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={output} downloadName="sorted.txt"
      placeholder="Paste your list here…"
      controls={
        <>
          <div className="w-full sm:w-52">
            <Select id="sort-mode" label="Sort" value={mode}
              onChange={(v) => setMode(v as SortMode)} options={SORT_MODES} />
          </div>
          <Toggle label="Case sensitive" checked={caseSensitive} onChange={setCaseSensitive} />
          {mode === "shuffle" ? (
            <Button variant="ghost" onClick={() => setSeed((s) => s + 1)}>Shuffle again</Button>
          ) : null}
        </>
      }
    />
  );
}

export function TextReverser() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"characters" | "words" | "lines">("characters");
  const output = useMemo(() => reverseText(input, mode), [input, mode]);

  return (
    <InOutTool
      input={input} setInput={setInput} output={output} downloadName="reversed.txt"
      controls={
        <div className="w-full sm:w-52">
          <Select id="rev-mode" label="Reverse by" value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              { value: "characters", label: "Characters" },
              { value: "words", label: "Word order" },
              { value: "lines", label: "Line order" },
            ]} />
        </div>
      }
    />
  );
}

export function FindReplaceTool() {
  const [input, setInput] = useState("");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [wholeWord, setWholeWord] = useState(false);

  const result = useMemo(
    () => findReplace(input, find, replace, { regex, caseSensitive, wholeWord }),
    [input, find, replace, regex, caseSensitive, wholeWord],
  );

  return (
    <InOutTool
      input={input} setInput={setInput} output={result.output} error={result.error}
      downloadName="replaced.txt"
      controls={
        <>
          <div className="w-full sm:w-56">
            <Label htmlFor="find">Find</Label>
            <input id="find" value={find} onChange={(e) => setFind(e.target.value)}
              placeholder={regex ? "\\d+" : "text to find"}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="replace">Replace with</Label>
            <input id="replace" value={replace} onChange={(e) => setReplace(e.target.value)}
              placeholder={regex ? "$1" : "replacement"}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="flex flex-wrap gap-4 pb-2">
            <Toggle label="Regex" checked={regex} onChange={setRegex} />
            <Toggle label="Case sensitive" checked={caseSensitive} onChange={setCaseSensitive} />
            {!regex ? <Toggle label="Whole words" checked={wholeWord} onChange={setWholeWord} /> : null}
          </div>
        </>
      }
      stats={find && !result.error ? (
        <EmptyNote>{result.count === 0 ? "No matches found." : `${result.count} replacement${result.count === 1 ? "" : "s"}.`}</EmptyNote>
      ) : undefined}
    />
  );
}

export function Extractor({ kind }: { kind: "emails" | "urls" }) {
  const [input, setInput] = useState("");
  const [unique, setUnique] = useState(true);
  const [separator, setSeparator] = useState<"newline" | "comma">("newline");

  const items = useMemo(
    () => (kind === "emails" ? extractEmails(input, unique) : extractUrls(input, unique)),
    [input, kind, unique],
  );
  const output = items.join(separator === "newline" ? "\n" : ", ");

  return (
    <InOutTool
      input={input} setInput={setInput} output={output}
      downloadName={`${kind}.txt`}
      placeholder="Paste text containing the addresses or links…"
      controls={
        <>
          <Toggle label="Remove duplicates" checked={unique} onChange={setUnique} />
          <div className="w-full sm:w-44">
            <Select id="sep" label="Separate with" value={separator}
              onChange={(v) => setSeparator(v as typeof separator)}
              options={[{ value: "newline", label: "New lines" }, { value: "comma", label: "Commas" }]} />
          </div>
        </>
      }
      stats={input ? <EmptyNote>Found {items.length} {kind === "emails" ? "address" : "link"}{items.length === 1 ? "" : "es"}.</EmptyNote> : undefined}
    />
  );
}
