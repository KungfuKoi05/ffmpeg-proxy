import { describe, expect, it } from "vitest";
import {
  formatJson, parseJson, sortJsonKeys, jsonStats,
  encodeBase64, decodeBase64, encodeUrl, decodeUrl,
  generateUuid, isValidUuid, fromUnix, parseDateString, testRegex,
} from "@/lib/tools/dev";

describe("JSON", () => {
  it("formats valid JSON with the chosen indent", () => {
    const r = formatJson('{"a":1}', 2);
    expect(r.ok).toBe(true);
    expect(r.value).toBe('{\n  "a": 1\n}');
  });

  it("minifies with indent 0", () => {
    expect(formatJson('{\n "a": 1\n}', 0).value).toBe('{"a":1}');
  });

  it("reports the line and column of a syntax error", () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.line).toBeGreaterThan(0);
  });

  it("rejects empty input with a human message, not a crash", () => {
    expect(parseJson("   ")).toMatchObject({ ok: false });
    expect(parseJson("   ").error).toMatch(/Nothing to parse/);
  });

  it("sorts keys recursively", () => {
    expect(JSON.stringify(sortJsonKeys({ b: 1, a: { d: 2, c: 3 } })))
      .toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("leaves array order alone when sorting keys", () => {
    expect(sortJsonKeys([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it("computes depth and key counts", () => {
    const s = jsonStats({ a: { b: { c: 1 } } });
    expect(s.keys).toBe(3);
    expect(s.depth).toBe(4);
  });
});

describe("Base64", () => {
  it("round-trips ASCII", () => {
    expect(decodeBase64(encodeBase64("hello")).value).toBe("hello");
  });

  it("round-trips UTF-8 that plain btoa would reject", () => {
    const tricky = "héllo 👋 日本語";
    expect(decodeBase64(encodeBase64(tricky)).value).toBe(tricky);
  });

  it("produces url-safe output without padding or + /", () => {
    const encoded = encodeBase64("??>>??>>", true);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("decodes url-safe input by restoring padding", () => {
    const s = "subjects?_d=1";
    expect(decodeBase64(encodeBase64(s, true)).value).toBe(s);
  });

  it("rejects an impossible length", () => {
    expect(decodeBase64("abcde").ok).toBe(false);
  });

  it("rejects characters Base64 never uses", () => {
    const r = decodeBase64("!!!!");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/never uses/);
  });

  it("reports empty input rather than returning empty output", () => {
    expect(decodeBase64("  ").ok).toBe(false);
  });
});

describe("URL encoding", () => {
  it("escapes reserved characters in component mode", () => {
    expect(encodeUrl("a=1&b=2")).toBe("a%3D1%26b%3D2");
  });

  it("preserves URL structure in full mode", () => {
    expect(encodeUrl("https://x.com/a b", false)).toBe("https://x.com/a%20b");
  });

  it("round-trips", () => {
    const s = "hello world/?&=#";
    expect(decodeUrl(encodeUrl(s)).value).toBe(s);
  });

  it("explains an invalid percent escape instead of throwing", () => {
    const r = decodeUrl("%ZZ");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/percent-escape/);
  });
});

describe("UUID", () => {
  it("generates a valid v4", () => {
    expect(isValidUuid(generateUuid())).toBe(true);
  });

  it("generates distinct values", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateUuid()));
    expect(set.size).toBe(200);
  });

  it("sets the version and variant bits even in the fallback path", () => {
    const id = generateUuid(() => 0.5);
    expect(id[14]).toBe("4");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("rejects malformed input", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

describe("timestamps", () => {
  it("converts seconds to ISO", () => {
    const r = fromUnix(0, "s");
    expect(r.ok).toBe(true);
    expect(r.value!.iso).toBe("1970-01-01T00:00:00.000Z");
  });

  it("handles milliseconds", () => {
    expect(fromUnix(1_000, "ms").value!.seconds).toBe(1);
  });

  it("rejects a nonsense timestamp", () => {
    expect(fromUnix(Number.NaN).ok).toBe(false);
  });

  it("parses a date string", () => {
    expect(parseDateString("2026-01-01T00:00:00Z").value!.seconds).toBe(1767225600);
  });

  it("reports unreadable dates", () => {
    const r = parseDateString("not a date");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Couldn't read/);
  });
});

describe("regex tester", () => {
  it("returns every match with its index", () => {
    const r = testRegex("\\d+", "", "a1b22c333");
    expect(r.ok).toBe(true);
    expect(r.matches.map((m) => m.match)).toEqual(["1", "22", "333"]);
    expect(r.matches[0].index).toBe(1);
  });

  it("exposes capture groups", () => {
    const r = testRegex("(\\w)(\\d)", "", "a1");
    expect(r.matches[0].groups).toEqual(["a", "1"]);
  });

  it("exposes named groups", () => {
    const r = testRegex("(?<letter>\\w)", "", "x");
    expect(r.matches[0].named.letter).toBe("x");
  });

  it("reports an invalid pattern instead of throwing", () => {
    const r = testRegex("([", "", "abc");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("terminates on a zero-length match instead of hanging", () => {
    const r = testRegex("a*", "", "bbb");
    expect(r.ok).toBe(true);
    expect(r.matches.length).toBeLessThan(100);
  });

  it("returns no matches for an empty pattern", () => {
    expect(testRegex("", "", "abc").matches).toEqual([]);
  });
});
