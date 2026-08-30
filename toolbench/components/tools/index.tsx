"use client";

import {
  WordCounter, CharacterCounter, CaseConverter, LineCleaner, LineSorter,
  TextReverser, FindReplaceTool, Extractor,
} from "./text-tools";
import {
  JsonFormatter, Base64Tool, UrlTool, UuidGenerator, TimestampConverter, RegexTester,
} from "./dev-tools";
import {
  PercentageCalculator, DiscountCalculator, MarginCalculator, LoanCalculator,
  CompoundInterestCalculator, SalaryCalculator, PaintCalculator, ConcreteCalculator,
} from "./calc-tools";
import { ImageTool } from "./image-tools";
import { PdfMerge, PdfPageTool } from "./pdf-tools";
import { PdfCompress, PdfToJpg } from "./pdf-render-tools";

/**
 * Slug -> component. The registry decides which tools exist and how they are
 * described; this decides what each one renders. A registry entry with no
 * component here is caught by tests/tools.test.ts rather than 500ing in prod.
 */
export const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  // text
  "word-counter": WordCounter,
  "character-counter": CharacterCounter,
  "case-converter": CaseConverter,
  "remove-duplicate-lines": () => <LineCleaner mode="dedupe" />,
  "remove-empty-lines": () => <LineCleaner mode="empty" />,
  "remove-extra-spaces": () => <LineCleaner mode="spaces" />,
  "sort-lines": LineSorter,
  "reverse-text": TextReverser,
  "find-and-replace": FindReplaceTool,
  "extract-emails": () => <Extractor kind="emails" />,
  "extract-urls": () => <Extractor kind="urls" />,
  // developer
  "json-formatter": JsonFormatter,
  "base64-encoder": Base64Tool,
  "url-encoder": UrlTool,
  "uuid-generator": UuidGenerator,
  "timestamp-converter": TimestampConverter,
  "regex-tester": RegexTester,
  // calculators
  "percentage-calculator": PercentageCalculator,
  "discount-calculator": DiscountCalculator,
  "profit-margin-calculator": MarginCalculator,
  "loan-calculator": LoanCalculator,
  "compound-interest-calculator": CompoundInterestCalculator,
  "hourly-to-salary-calculator": SalaryCalculator,
  "paint-calculator": PaintCalculator,
  "concrete-calculator": ConcreteCalculator,
  // image
  "image-compressor": () => <ImageTool mode="compress" />,
  "image-resizer": () => <ImageTool mode="resize" />,
  "jpg-to-png": () => <ImageTool mode="convert" fixedFormat="png" />,
  "png-to-jpg": () => <ImageTool mode="convert" fixedFormat="jpeg" />,
  "webp-converter": () => <ImageTool mode="convert" fixedFormat="webp" />,
  // pdf
  "merge-pdf": PdfMerge,
  "split-pdf": () => <PdfPageTool mode="extract" />,
  "delete-pdf-pages": () => <PdfPageTool mode="delete" />,
  "rotate-pdf": () => <PdfPageTool mode="rotate" />,
  "compress-pdf": PdfCompress,
  "pdf-to-jpg": PdfToJpg,
};

export function ToolRenderer({ slug }: { slug: string }) {
  const Component = TOOL_COMPONENTS[slug];
  if (!Component) {
    return (
      <p className="rounded-lg bg-[var(--surface-2)] px-4 py-6 text-center text-[14px] text-[var(--ink-2)]">
        This tool is being built. Everything else on the site works.
      </p>
    );
  }
  return <Component />;
}
