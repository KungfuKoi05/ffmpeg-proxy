import { describe, expect, it } from "vitest";
import {
  analyzeText, convertCase, removeDuplicateLines, removeEmptyLines,
  removeExtraSpaces, sortLines, reverseText, findReplace,
  extractUrls, extractEmails,
} from "@/lib/tools/text";

describe("analyzeText", () => {
  it("counts an empty string as all zeros", () => {
    const s = analyzeText("");
    expect(s.words).toBe(0);
    expect(s.characters).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.sentences).toBe(0);
  });

  it("does not let surrounding whitespace inflate the word count", () => {
    expect(analyzeText("   hello   world   ").words).toBe(2);
  });

  it("counts characters with and without spaces", () => {
    const s = analyzeText("a b c");
    expect(s.characters).toBe(5);
    expect(s.charactersNoSpaces).toBe(3);
  });

  it("counts emoji as one visible character, not two code units", () => {
    expect(analyzeText("👍").characters).toBe(1);
  });

  it("treats repeated terminators as one sentence", () => {
    expect(analyzeText("Wait!!! Stop.").sentences).toBe(2);
  });

  it("counts paragraphs split by blank lines", () => {
    expect(analyzeText("One.\n\nTwo.\n\nThree.").paragraphs).toBe(3);
  });

  it("derives reading time from the word count", () => {
    const s = analyzeText(Array(238).fill("word").join(" "));
    expect(s.readingMinutes).toBeCloseTo(1, 5);
  });
});

describe("convertCase", () => {
  it("handles the simple modes", () => {
    expect(convertCase("Hello World", "upper")).toBe("HELLO WORLD");
    expect(convertCase("Hello World", "lower")).toBe("hello world");
    expect(convertCase("Hello", "toggle")).toBe("hELLO");
  });

  it("keeps minor words lowercase in title case but capitalises the first", () => {
    expect(convertCase("the lord of the rings", "title")).toBe("The Lord of the Rings");
  });

  it("capitalises after each sentence terminator in sentence case", () => {
    expect(convertCase("hello there. how are you? fine!", "sentence"))
      .toBe("Hello there. How are you? Fine!");
  });

  it("produces programmer cases from arbitrary separators", () => {
    expect(convertCase("hello world-again", "camel")).toBe("helloWorldAgain");
    expect(convertCase("Hello World", "snake")).toBe("hello_world");
    expect(convertCase("Hello World", "kebab")).toBe("hello-world");
  });

  it("returns empty string for camel case of nothing", () => {
    expect(convertCase("   ", "camel")).toBe("");
  });
});

describe("line tools", () => {
  it("keeps the first duplicate and preserves order", () => {
    expect(removeDuplicateLines("b\na\nb\nc\na")).toBe("b\na\nc");
  });

  it("can match case-insensitively", () => {
    expect(removeDuplicateLines("Apple\napple", { caseSensitive: false })).toBe("Apple");
  });

  it("can trim before comparing", () => {
    expect(removeDuplicateLines("a\n  a  ", { trimEach: true })).toBe("a");
  });

  it("removes whitespace-only lines", () => {
    expect(removeEmptyLines("a\n\n   \nb")).toBe("a\nb");
  });

  it("collapses spaces and trims each line but keeps blank lines", () => {
    expect(removeExtraSpaces("a    b  \n\n  c ")).toBe("a b\n\nc");
  });
});

describe("sortLines", () => {
  it("sorts alphabetically both ways", () => {
    expect(sortLines("c\na\nb", "alpha")).toBe("a\nb\nc");
    expect(sortLines("a\nc\nb", "alpha-desc")).toBe("c\nb\na");
  });

  it("sorts numerically rather than as strings", () => {
    // A string sort would put 10 before 9.
    expect(sortLines("10\n9\n2", "numeric")).toBe("2\n9\n10");
  });

  it("sinks non-numeric lines to the bottom in numeric mode", () => {
    expect(sortLines("banana\n2\n1", "numeric")).toBe("1\n2\nbanana");
  });

  it("sorts by length", () => {
    expect(sortLines("ccc\na\nbb", "length")).toBe("a\nbb\nccc");
  });

  it("shuffles deterministically when given a seeded rng", () => {
    const seq = [0.9, 0.1, 0.5, 0.3];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const a = sortLines("1\n2\n3\n4", "shuffle", { random: rng });
    i = 0;
    const b = sortLines("1\n2\n3\n4", "shuffle", { random: rng });
    expect(a).toBe(b);
    expect(a.split("\n").sort()).toEqual(["1", "2", "3", "4"]);
  });
});

describe("reverseText", () => {
  it("reverses characters, keeping emoji intact", () => {
    expect(reverseText("abc", "characters")).toBe("cba");
    expect(reverseText("a👍b", "characters")).toBe("b👍a");
  });

  it("reverses word order while preserving spacing", () => {
    expect(reverseText("one two three", "words")).toBe("three two one");
  });

  it("reverses line order", () => {
    expect(reverseText("1\n2\n3", "lines")).toBe("3\n2\n1");
  });
});

describe("findReplace", () => {
  it("replaces literally and reports the count", () => {
    const r = findReplace("a.b.c", ".", "-");
    expect(r.output).toBe("a-b-c");
    expect(r.count).toBe(2);
  });

  it("escapes regex metacharacters in literal mode", () => {
    // Without escaping, "." would match every character.
    expect(findReplace("abc", ".", "-").output).toBe("abc");
  });

  it("supports regex mode with capture groups", () => {
    const r = findReplace("John Smith", "(\\w+) (\\w+)", "$2, $1", { regex: true });
    expect(r.output).toBe("Smith, John");
  });

  it("matches whole words only when asked", () => {
    expect(findReplace("cat category", "cat", "dog", { wholeWord: true }).output)
      .toBe("dog category");
  });

  it("returns the error and leaves text untouched on a bad pattern", () => {
    const r = findReplace("abc", "([", "x", { regex: true });
    expect(r.error).toBeTruthy();
    expect(r.output).toBe("abc");
    expect(r.count).toBe(0);
  });

  it("is a no-op when the search string is empty", () => {
    expect(findReplace("abc", "", "x")).toEqual({ output: "abc", count: 0 });
  });
});

describe("extractors", () => {
  it("finds urls and strips trailing sentence punctuation", () => {
    expect(extractUrls("Go to https://example.com/page. Then www.foo.io!"))
      .toEqual(["https://example.com/page", "www.foo.io"]);
  });

  it("deduplicates urls", () => {
    expect(extractUrls("https://a.com https://a.com")).toEqual(["https://a.com"]);
  });

  it("finds emails and lowercases them", () => {
    expect(extractEmails("Bob@Example.com and sue@test.co.uk"))
      .toEqual(["bob@example.com", "sue@test.co.uk"]);
  });

  it("returns an empty array when there is nothing to find", () => {
    expect(extractEmails("no addresses here")).toEqual([]);
    expect(extractUrls("no links here")).toEqual([]);
  });
});
