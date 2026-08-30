/**
 * Text transforms. Pure functions, no DOM, no I/O -- so every one of them is
 * unit-testable and runs identically in the browser. Nothing here ever touches
 * a server, which is what makes these tools cost nothing to operate.
 */

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
}

/** Average adult silent reading speed; speaking is slower. Both are estimates. */
const WORDS_PER_MINUTE_READING = 238;
const WORDS_PER_MINUTE_SPEAKING = 140;

export function analyzeText(input: string): TextStats {
  const characters = [...input].length;
  const charactersNoSpaces = [...input.replace(/\s/g, "")].length;

  // Split on any whitespace run; filter empties so leading/trailing space
  // doesn't inflate the count.
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  // A sentence ends at . ! ? or their full-width equivalents. Consecutive
  // terminators ("Wait!!!") count once.
  const sentences = (input.match(/[^\s.!?。！？]+(?:[.!?。！？]+|$)/g) ?? []).filter((s) =>
    s.trim().length > 0,
  ).length;

  const paragraphs = input.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = input === "" ? 0 : input.split(/\r\n|\r|\n/).length;

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    readingMinutes: words / WORDS_PER_MINUTE_READING,
    speakingMinutes: words / WORDS_PER_MINUTE_SPEAKING,
  };
}

export type CaseMode =
  | "upper" | "lower" | "title" | "sentence" | "camel" | "snake" | "kebab" | "toggle";

/** Words kept lowercase in title case unless they lead the string. */
const MINOR_WORDS = new Set([
  "a","an","and","as","at","but","by","for","in","nor","of","on","or","per",
  "so","the","to","up","via","vs","yet",
]);

export function convertCase(input: string, mode: CaseMode): string {
  switch (mode) {
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "toggle":
      return [...input]
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join("");
    case "title":
      return input.replace(/\S+/g, (word, offset: number) => {
        const lower = word.toLowerCase();
        const isFirst = offset === 0 || /^\s*$/.test(input.slice(0, offset).split("\n").pop() ?? "");
        if (!isFirst && MINOR_WORDS.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      });
    case "sentence": {
      const lower = input.toLowerCase();
      // Capitalise the first letter of the string and after each terminator.
      return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
    }
    case "camel": {
      const parts = input.split(/[^A-Za-z0-9]+/).filter(Boolean);
      if (!parts.length) return "";
      return (
        parts[0].toLowerCase() +
        parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
      );
    }
    case "snake":
      return input.split(/[^A-Za-z0-9]+/).filter(Boolean).join("_").toLowerCase();
    case "kebab":
      return input.split(/[^A-Za-z0-9]+/).filter(Boolean).join("-").toLowerCase();
  }
}

export interface LineOptions {
  trimEach?: boolean;
  caseSensitive?: boolean;
}

export function removeDuplicateLines(input: string, opts: LineOptions = {}): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/\r\n|\r|\n/)) {
    const line = opts.trimEach ? raw.trim() : raw;
    const key = opts.caseSensitive === false ? line.toLowerCase() : line;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

export function removeEmptyLines(input: string): string {
  return input
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/** Collapses runs of spaces/tabs and trims each line. Blank lines survive. */
export function removeExtraSpaces(input: string): string {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
}

export type SortMode = "alpha" | "alpha-desc" | "length" | "length-desc" | "numeric" | "shuffle";

export function sortLines(
  input: string,
  mode: SortMode,
  opts: { caseSensitive?: boolean; random?: () => number } = {},
): string {
  const lines = input.split(/\r\n|\r|\n/);
  const cmpAlpha = (a: string, b: string) =>
    opts.caseSensitive === false
      ? a.toLowerCase().localeCompare(b.toLowerCase())
      : a.localeCompare(b);

  switch (mode) {
    case "alpha":
      return [...lines].sort(cmpAlpha).join("\n");
    case "alpha-desc":
      return [...lines].sort((a, b) => cmpAlpha(b, a)).join("\n");
    case "length":
      return [...lines].sort((a, b) => a.length - b.length).join("\n");
    case "length-desc":
      return [...lines].sort((a, b) => b.length - a.length).join("\n");
    case "numeric":
      return [...lines]
        .sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b);
          // Non-numeric lines sink to the bottom rather than scrambling.
          if (Number.isNaN(na) && Number.isNaN(nb)) return cmpAlpha(a, b);
          if (Number.isNaN(na)) return 1;
          if (Number.isNaN(nb)) return -1;
          return na - nb;
        })
        .join("\n");
    case "shuffle": {
      const rng = opts.random ?? Math.random;
      const arr = [...lines];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.join("\n");
    }
  }
}

export function reverseText(
  input: string,
  mode: "characters" | "words" | "lines",
): string {
  if (mode === "characters") return [...input].reverse().join("");
  if (mode === "words") return input.split(/(\s+)/).reverse().join("");
  return input.split(/\r\n|\r|\n/).reverse().join("\n");
}

export interface ReplaceOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface ReplaceResult {
  output: string;
  count: number;
  error?: string;
}

export function findReplace(
  input: string,
  find: string,
  replace: string,
  opts: ReplaceOptions = {},
): ReplaceResult {
  if (!find) return { output: input, count: 0 };

  let pattern: RegExp;
  try {
    const source = opts.regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrapped = opts.wholeWord && !opts.regex ? `\\b${source}\\b` : source;
    pattern = new RegExp(wrapped, opts.caseSensitive === false ? "gi" : "g");
  } catch (err) {
    // An invalid user regex is a validation problem, not a crash.
    return { output: input, count: 0, error: err instanceof Error ? err.message : "Invalid pattern" };
  }

  // Count first, then replace with the STRING form. A function replacement
  // would make JS treat "$1" as literal text instead of a capture-group
  // reference, silently breaking the documented regex behaviour.
  const count = [...input.matchAll(pattern)].length;
  const output = input.replace(pattern, replace);
  return { output, count };
}

/** Matches http(s) and bare www. hosts. Trailing sentence punctuation is dropped. */
export function extractUrls(input: string, unique = true): string[] {
  const matches = input.match(/\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi) ?? [];
  const cleaned = matches.map((m) => m.replace(/[.,;:!?)\]}'"]+$/, ""));
  return unique ? [...new Set(cleaned)] : cleaned;
}

export function extractEmails(input: string, unique = true): string[] {
  const matches = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const lowered = matches.map((m) => m.toLowerCase());
  return unique ? [...new Set(lowered)] : lowered;
}

export function extractNumbers(input: string): string[] {
  return input.match(/-?\d[\d,]*\.?\d*/g) ?? [];
}
