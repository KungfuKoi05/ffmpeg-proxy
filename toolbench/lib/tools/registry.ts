/**
 * The tool catalogue.
 *
 * This is the single source of truth. Pages, the sitemap, the directory,
 * related-tool links, breadcrumbs and structured data are all generated from
 * it, so adding a tool is one entry plus one component -- not seven files kept
 * manually in sync. That is what makes the SEO surface scale without turning
 * into spam.
 */

export type CategoryId = "pdf" | "image" | "text" | "developer" | "calculators";

export interface Category {
  id: CategoryId;
  name: string;
  slug: string;
  blurb: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  pdf: {
    id: "pdf", name: "PDF tools", slug: "pdf",
    blurb: "Merge, split, compress and convert PDFs. Files never leave your device.",
  },
  image: {
    id: "image", name: "Image tools", slug: "image",
    blurb: "Compress, resize and convert images without uploading them anywhere.",
  },
  text: {
    id: "text", name: "Text tools", slug: "text",
    blurb: "Count, clean, sort and rewrite text instantly.",
  },
  developer: {
    id: "developer", name: "Developer tools", slug: "developer",
    blurb: "Format, encode, decode and test — the everyday utilities.",
  },
  calculators: {
    id: "calculators", name: "Calculators", slug: "calculators",
    blurb: "Percentages, margins, loans and material estimates.",
  },
};

/** Where the work happens. "browser" means zero marginal cost and no upload. */
export type Processing = "browser";

export interface Faq {
  q: string;
  a: string;
}

export interface Tool {
  slug: string;
  name: string;
  /** The <h1>. Often differs from the nav name to match how people search. */
  h1: string;
  category: CategoryId;
  /** One line under the h1. Also the meta description base. */
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  /** Terms this page should legitimately answer. Not stuffed into copy. */
  keywords: string[];
  processing: Processing;
  /** Slugs of genuinely adjacent tools. Drives internal linking. */
  related: string[];
  faq: Faq[];
  /** Free-tier ceiling, enforced client-side. null = unlimited. */
  freeLimit: number | null;
  limitUnit?: string;
  /** Hidden from the directory and sitemap until true. */
  live: boolean;
}

export const TOOLS: Tool[] = [
  /* ------------------------------------------------------------- text ---- */
  {
    slug: "word-counter",
    name: "Word counter",
    h1: "Word counter",
    category: "text",
    tagline: "Count words, characters, sentences and paragraphs as you type.",
    metaTitle: "Word Counter — Free Online Word & Character Count",
    metaDescription:
      "Count words, characters, sentences, paragraphs and reading time instantly. Free, no signup, and your text never leaves your browser.",
    keywords: ["word counter", "character count", "word count tool", "words to minutes"],
    processing: "browser",
    related: ["character-counter", "remove-duplicate-lines", "case-converter", "remove-extra-spaces"],
    freeLimit: null,
    faq: [
      { q: "Does my text get uploaded?", a: "No. Counting happens entirely in your browser — nothing is sent to a server, so nothing is stored." },
      { q: "How is reading time calculated?", a: "At 238 words per minute for silent reading and 140 for speaking aloud. Both are averages, so treat them as estimates." },
      { q: "How do you count sentences?", a: "A sentence ends at a full stop, question mark or exclamation mark. Repeated marks (\"wait!!!\") count once." },
      { q: "Is there a length limit?", a: "No. Very large documents may briefly slow your browser, but nothing is truncated." },
    ],
    live: true,
  },
  {
    slug: "character-counter",
    name: "Character counter",
    h1: "Character counter",
    category: "text",
    tagline: "Count characters with and without spaces, against common limits.",
    metaTitle: "Character Counter — Count Characters Online Free",
    metaDescription:
      "Count characters with and without spaces and check against Twitter, SMS and meta-description limits. Free and private.",
    keywords: ["character counter", "character count online", "letter counter"],
    processing: "browser",
    related: ["word-counter", "remove-extra-spaces", "case-converter"],
    freeLimit: null,
    faq: [
      { q: "Do spaces count as characters?", a: "Usually yes — most platforms count them. We show both figures so you can use whichever your platform applies." },
      { q: "Why does my count differ from another tool?", a: "Emoji and accented letters can be one visible character but several code units. We count what a person would see." },
    ],
    live: true,
  },
  {
    slug: "case-converter",
    name: "Case converter",
    h1: "Text case converter",
    category: "text",
    tagline: "Switch text between upper, lower, title, sentence, camel, snake and kebab case.",
    metaTitle: "Case Converter — Upper, Lower, Title & Sentence Case",
    metaDescription:
      "Convert text to uppercase, lowercase, title case, sentence case, camelCase, snake_case or kebab-case instantly. Free, private, no signup.",
    keywords: ["case converter", "title case converter", "uppercase converter", "camel case converter"],
    processing: "browser",
    related: ["word-counter", "remove-extra-spaces", "sort-lines", "find-and-replace"],
    freeLimit: null,
    faq: [
      { q: "How does title case handle small words?", a: "Words like \"of\", \"and\" and \"the\" stay lowercase unless they start the line, which follows standard English title case." },
      { q: "What is sentence case?", a: "Everything lowercase except the first letter of each sentence — useful for fixing text pasted in all caps." },
    ],
    live: true,
  },
  {
    slug: "remove-duplicate-lines",
    name: "Remove duplicate lines",
    h1: "Remove duplicate lines",
    category: "text",
    tagline: "Strip repeated lines from a list, keeping the first of each.",
    metaTitle: "Remove Duplicate Lines — Free Online Deduplicate Tool",
    metaDescription:
      "Remove duplicate lines from any list instantly. Optional trimming and case-insensitive matching. Free and runs in your browser.",
    keywords: ["remove duplicate lines", "deduplicate list", "delete repeated lines"],
    processing: "browser",
    related: ["sort-lines", "remove-empty-lines", "remove-extra-spaces", "word-counter"],
    freeLimit: null,
    faq: [
      { q: "Which duplicate is kept?", a: "The first occurrence. The original order of the remaining lines is preserved." },
      { q: "Can it ignore capitalisation?", a: "Yes — turn off case sensitivity and \"Apple\" and \"apple\" are treated as the same line." },
    ],
    live: true,
  },
  {
    slug: "remove-empty-lines",
    name: "Remove empty lines",
    h1: "Remove empty lines",
    category: "text",
    tagline: "Delete blank and whitespace-only lines from any text.",
    metaTitle: "Remove Empty Lines — Delete Blank Lines Online",
    metaDescription:
      "Remove blank and whitespace-only lines from text instantly. Free, no signup, processed entirely in your browser.",
    keywords: ["remove empty lines", "delete blank lines", "remove line breaks"],
    processing: "browser",
    related: ["remove-extra-spaces", "remove-duplicate-lines", "sort-lines"],
    freeLimit: null,
    faq: [
      { q: "Are lines with only spaces removed?", a: "Yes. A line containing nothing but spaces or tabs counts as empty." },
    ],
    live: true,
  },
  {
    slug: "remove-extra-spaces",
    name: "Remove extra spaces",
    h1: "Remove extra spaces",
    category: "text",
    tagline: "Collapse repeated spaces and trim every line.",
    metaTitle: "Remove Extra Spaces — Clean Up Text Online Free",
    metaDescription:
      "Collapse double spaces, strip trailing whitespace and tidy pasted text in one click. Free and fully private.",
    keywords: ["remove extra spaces", "remove double spaces", "trim whitespace"],
    processing: "browser",
    related: ["remove-empty-lines", "case-converter", "find-and-replace"],
    freeLimit: null,
    faq: [
      { q: "Are blank lines preserved?", a: "Yes. This collapses spaces within lines and trims their ends — use Remove empty lines to drop blank lines too." },
    ],
    live: true,
  },
  {
    slug: "sort-lines",
    name: "Sort lines",
    h1: "Sort lines alphabetically",
    category: "text",
    tagline: "Sort a list alphabetically, numerically, by length, or shuffle it.",
    metaTitle: "Sort Lines — Alphabetical & Numerical Line Sorter",
    metaDescription:
      "Sort any list alphabetically, numerically, by length, reversed or shuffled. Free, instant, and private to your browser.",
    keywords: ["sort lines", "alphabetize list", "sort list alphabetically", "line sorter"],
    processing: "browser",
    related: ["remove-duplicate-lines", "remove-empty-lines", "reverse-text"],
    freeLimit: null,
    faq: [
      { q: "How are numbers sorted?", a: "Numeric sort reads the number at the start of each line. Lines without one move to the bottom rather than scrambling." },
      { q: "Does it sort accented characters correctly?", a: "Yes — it uses locale-aware comparison, so é sorts next to e rather than at the end." },
    ],
    live: true,
  },
  {
    slug: "reverse-text",
    name: "Reverse text",
    h1: "Reverse text",
    category: "text",
    tagline: "Flip text by character, by word, or by line.",
    metaTitle: "Reverse Text — Flip Characters, Words or Lines",
    metaDescription:
      "Reverse text by character, word or line order instantly. Free, private, handles emoji correctly.",
    keywords: ["reverse text", "backwards text generator", "reverse word order"],
    processing: "browser",
    related: ["case-converter", "sort-lines", "word-counter"],
    freeLimit: null,
    faq: [
      { q: "Does it handle emoji?", a: "Yes. It reverses by visible character, so emoji and accented letters don't break apart." },
    ],
    live: true,
  },
  {
    slug: "find-and-replace",
    name: "Find and replace",
    h1: "Find and replace text",
    category: "text",
    tagline: "Replace text across a whole document, with optional regex.",
    metaTitle: "Find and Replace Text Online — Free Bulk Replace",
    metaDescription:
      "Find and replace text in bulk, with case sensitivity, whole-word and regular expression support. Free and browser-based.",
    keywords: ["find and replace online", "bulk replace text", "regex replace"],
    processing: "browser",
    related: ["remove-extra-spaces", "case-converter", "regex-tester", "extract-emails"],
    freeLimit: null,
    faq: [
      { q: "Does it support regular expressions?", a: "Yes. Turn on regex mode and use capture groups like $1 in the replacement." },
      { q: "What if my pattern is invalid?", a: "You get the error message rather than a silent failure, and your text is left untouched." },
    ],
    live: true,
  },
  {
    slug: "extract-emails",
    name: "Extract emails",
    h1: "Extract email addresses from text",
    category: "text",
    tagline: "Pull every email address out of a block of text.",
    metaTitle: "Extract Email Addresses From Text — Free Tool",
    metaDescription:
      "Extract every email address from pasted text, deduplicated and lowercased. Free, instant and completely private.",
    keywords: ["extract emails from text", "email extractor", "find email addresses in text"],
    processing: "browser",
    related: ["extract-urls", "find-and-replace", "remove-duplicate-lines"],
    freeLimit: null,
    faq: [
      { q: "Are duplicates removed?", a: "Yes by default, and addresses are lowercased so Bob@x.com and bob@x.com collapse into one." },
      { q: "Is this for scraping?", a: "It only reads text you paste in. How you use the addresses is your responsibility — sending unsolicited email is regulated in most countries." },
    ],
    live: true,
  },
  {
    slug: "extract-urls",
    name: "Extract URLs",
    h1: "Extract URLs from text",
    category: "text",
    tagline: "Pull every link out of a block of text.",
    metaTitle: "Extract URLs From Text — Free Link Extractor",
    metaDescription:
      "Extract every URL from pasted text, deduplicated with trailing punctuation removed. Free and browser-based.",
    keywords: ["extract urls from text", "link extractor", "find links in text"],
    processing: "browser",
    related: ["extract-emails", "find-and-replace", "sort-lines"],
    freeLimit: null,
    faq: [
      { q: "Does it catch links without http://?", a: "Yes — anything starting with www. is picked up too." },
      { q: "What about the full stop at the end of a sentence?", a: "Trailing punctuation is stripped, so a link at the end of a sentence comes out clean." },
    ],
    live: true,
  },

  /* -------------------------------------------------------- developer ---- */
  {
    slug: "json-formatter",
    name: "JSON formatter",
    h1: "JSON formatter and validator",
    category: "developer",
    tagline: "Format, validate and minify JSON, with the error location when it breaks.",
    metaTitle: "JSON Formatter & Validator — Free Online JSON Beautifier",
    metaDescription:
      "Format, validate, minify and sort JSON online. Shows the exact line and column of syntax errors. Free and never uploaded.",
    keywords: ["json formatter", "json validator", "json beautifier", "json pretty print"],
    processing: "browser",
    related: ["base64-encoder", "url-encoder", "regex-tester", "uuid-generator"],
    freeLimit: null,
    faq: [
      { q: "Is my JSON sent anywhere?", a: "No. Parsing happens in your browser, which matters when the JSON contains keys or customer data." },
      { q: "What does sorting keys do?", a: "It orders object keys alphabetically at every level, which makes two similar payloads comparable by eye." },
      { q: "Why does it reject my JSON?", a: "Common causes are trailing commas, single quotes instead of double, and unquoted keys. The error shows the line and column." },
    ],
    live: true,
  },
  {
    slug: "base64-encoder",
    name: "Base64 encoder",
    h1: "Base64 encoder and decoder",
    category: "developer",
    tagline: "Encode and decode Base64, including URL-safe variants.",
    metaTitle: "Base64 Encode & Decode Online — Free UTF-8 Safe",
    metaDescription:
      "Encode and decode Base64 with full UTF-8 and URL-safe support. Free, instant, and processed entirely in your browser.",
    keywords: ["base64 encode", "base64 decode", "base64 converter", "url safe base64"],
    processing: "browser",
    related: ["url-encoder", "json-formatter", "uuid-generator"],
    freeLimit: null,
    faq: [
      { q: "Does it handle emoji and accents?", a: "Yes. Naive Base64 tools break on anything outside Latin-1; this encodes UTF-8 properly first." },
      { q: "What is URL-safe Base64?", a: "It swaps + and / for - and _ and drops padding, so the result survives being put in a URL." },
      { q: "Is Base64 encryption?", a: "No. It is encoding, not encryption — anyone can decode it. Never use it to hide secrets." },
    ],
    live: true,
  },
  {
    slug: "url-encoder",
    name: "URL encoder",
    h1: "URL encoder and decoder",
    category: "developer",
    tagline: "Percent-encode and decode URLs and query strings.",
    metaTitle: "URL Encoder & Decoder — Free Percent Encoding Tool",
    metaDescription:
      "Encode and decode URLs and query-string parameters. Handles full URLs and single components. Free and private.",
    keywords: ["url encoder", "url decoder", "percent encoding", "urlencode online"],
    processing: "browser",
    related: ["base64-encoder", "json-formatter", "extract-urls"],
    freeLimit: null,
    faq: [
      { q: "Component or full URL?", a: "Component mode escapes / ? & and = — right for a single parameter value. Full-URL mode leaves the structure intact." },
      { q: "Why does decoding fail?", a: "A stray % that isn't followed by two hex digits is invalid. The tool tells you rather than returning mangled text." },
    ],
    live: true,
  },
  {
    slug: "uuid-generator",
    name: "UUID generator",
    h1: "UUID generator",
    category: "developer",
    tagline: "Generate cryptographically random v4 UUIDs in bulk.",
    metaTitle: "UUID Generator — Free Random v4 UUIDs Online",
    metaDescription:
      "Generate random RFC 4122 version 4 UUIDs in bulk using your browser's crypto API. Free, instant, nothing logged.",
    keywords: ["uuid generator", "guid generator", "random uuid", "uuid v4"],
    processing: "browser",
    related: ["base64-encoder", "json-formatter", "timestamp-converter"],
    freeLimit: 500,
    limitUnit: "UUIDs per batch",
    faq: [
      { q: "Are these actually random?", a: "Yes — they come from your browser's crypto API, the same source used for cryptographic keys, not Math.random." },
      { q: "Do you log the UUIDs?", a: "No. They are generated on your device and never sent anywhere." },
      { q: "What is a v4 UUID?", a: "A 128-bit identifier that is essentially all random bits. Collisions are so unlikely they can be ignored in practice." },
    ],
    live: true,
  },
  {
    slug: "timestamp-converter",
    name: "Timestamp converter",
    h1: "Unix timestamp converter",
    category: "developer",
    tagline: "Convert between Unix timestamps and human-readable dates.",
    metaTitle: "Unix Timestamp Converter — Epoch to Date Online",
    metaDescription:
      "Convert Unix timestamps to dates and back, in seconds or milliseconds, with ISO, UTC and relative output. Free and instant.",
    keywords: ["unix timestamp converter", "epoch converter", "timestamp to date"],
    processing: "browser",
    related: ["uuid-generator", "json-formatter", "base64-encoder"],
    freeLimit: null,
    faq: [
      { q: "Seconds or milliseconds?", a: "Unix time is seconds; JavaScript uses milliseconds. Pick the unit and the tool converts both ways." },
      { q: "Which timezone is shown?", a: "ISO and UTC output are timezone-independent. Relative time is worked out against your device clock." },
    ],
    live: true,
  },
  {
    slug: "regex-tester",
    name: "Regex tester",
    h1: "Regex tester",
    category: "developer",
    tagline: "Test regular expressions against sample text and see every match.",
    metaTitle: "Regex Tester — Test Regular Expressions Online Free",
    metaDescription:
      "Test JavaScript regular expressions against sample text with live match highlighting and capture groups. Free and private.",
    keywords: ["regex tester", "regular expression tester", "regex online", "test regex"],
    processing: "browser",
    related: ["find-and-replace", "json-formatter", "extract-emails"],
    freeLimit: null,
    faq: [
      { q: "Which regex flavour is this?", a: "JavaScript (ECMAScript), the same engine as your browser and Node. Some PCRE features like lookbehind vary by browser." },
      { q: "Will a bad pattern hang the page?", a: "Matching stops after 5,000 matches, so a runaway pattern can't lock the tab indefinitely." },
      { q: "Are capture groups shown?", a: "Yes, including named groups, for every match." },
    ],
    live: true,
  },

  /* ------------------------------------------------------ calculators ---- */
  {
    slug: "percentage-calculator",
    name: "Percentage calculator",
    h1: "Percentage calculator",
    category: "calculators",
    tagline: "Work out percentages, percentage change, and what percent one number is of another.",
    metaTitle: "Percentage Calculator — Percent Of, Change & Difference",
    metaDescription:
      "Calculate a percentage of a number, what percent one number is of another, and percentage increase or decrease. Free and instant.",
    keywords: ["percentage calculator", "percent change calculator", "what percent is x of y"],
    processing: "browser",
    related: ["discount-calculator", "profit-margin-calculator", "compound-interest-calculator"],
    freeLimit: null,
    faq: [
      { q: "How is percentage change calculated?", a: "(new − old) ÷ |old| × 100. Using the absolute value means the direction is right even when the starting number is negative." },
      { q: "Why can't I start from zero?", a: "Percentage change from zero is mathematically undefined — any increase from nothing is infinite." },
    ],
    live: true,
  },
  {
    slug: "discount-calculator",
    name: "Discount calculator",
    h1: "Discount calculator",
    category: "calculators",
    tagline: "Find the sale price and what you save, including stacked discounts.",
    metaTitle: "Discount Calculator — Sale Price & Savings",
    metaDescription:
      "Calculate sale price and savings from one or several stacked discounts. Shows the true effective discount rate. Free.",
    keywords: ["discount calculator", "sale price calculator", "percent off calculator"],
    processing: "browser",
    related: ["percentage-calculator", "profit-margin-calculator"],
    freeLimit: null,
    faq: [
      { q: "Is 30% off then 20% off the same as 50% off?", a: "No — it's 44% off. Discounts apply one after another to the reduced price. This tool shows the real effective rate." },
    ],
    live: true,
  },
  {
    slug: "profit-margin-calculator",
    name: "Profit margin calculator",
    h1: "Profit margin calculator",
    category: "calculators",
    tagline: "Calculate margin, markup, and the price needed to hit a target margin.",
    metaTitle: "Profit Margin Calculator — Margin vs Markup",
    metaDescription:
      "Calculate profit margin and markup from cost and revenue, or work backwards to the price that hits your target margin. Free.",
    keywords: ["profit margin calculator", "markup calculator", "margin vs markup"],
    processing: "browser",
    related: ["percentage-calculator", "discount-calculator", "hourly-to-salary-calculator"],
    freeLimit: null,
    faq: [
      { q: "What's the difference between margin and markup?", a: "Margin is profit as a share of the price you charge; markup is profit as a share of what it cost you. A 50% markup is only a 33% margin." },
      { q: "Why can't I target a 100% margin?", a: "A 100% margin means cost is zero. Anything at or above 100% would need an infinite price." },
    ],
    live: true,
  },
  {
    slug: "loan-calculator",
    name: "Loan calculator",
    h1: "Loan payment calculator",
    category: "calculators",
    tagline: "Monthly payment, total interest, and a full amortisation schedule.",
    metaTitle: "Loan Calculator — Monthly Payment & Total Interest",
    metaDescription:
      "Calculate monthly loan payments, total interest and a month-by-month amortisation schedule. Free, private, no signup.",
    keywords: ["loan calculator", "monthly payment calculator", "amortization calculator"],
    processing: "browser",
    related: ["compound-interest-calculator", "percentage-calculator", "profit-margin-calculator"],
    freeLimit: null,
    faq: [
      { q: "What formula is used?", a: "The standard amortising annuity formula. A 0% loan is handled separately as principal split evenly across the term." },
      { q: "Does it include tax and insurance?", a: "No. This is principal and interest only — a mortgage payment will be higher once escrow is added." },
      { q: "Is this financial advice?", a: "No. It is arithmetic. Your lender's figures are the ones that count." },
    ],
    live: true,
  },
  {
    slug: "compound-interest-calculator",
    name: "Compound interest calculator",
    h1: "Compound interest calculator",
    category: "calculators",
    tagline: "Project growth with regular contributions and any compounding frequency.",
    metaTitle: "Compound Interest Calculator — With Monthly Contributions",
    metaDescription:
      "Project savings growth with compound interest and regular monthly contributions. Year-by-year breakdown. Free and instant.",
    keywords: ["compound interest calculator", "investment growth calculator", "savings calculator"],
    processing: "browser",
    related: ["loan-calculator", "percentage-calculator"],
    freeLimit: null,
    faq: [
      { q: "How are contributions handled?", a: "As a monthly amount added at the end of each period, converted to match your chosen compounding frequency." },
      { q: "Does it account for inflation or tax?", a: "No. These are nominal figures before tax, fees and inflation — all of which reduce the real result." },
    ],
    live: true,
  },
  {
    slug: "hourly-to-salary-calculator",
    name: "Hourly to salary",
    h1: "Hourly to salary calculator",
    category: "calculators",
    tagline: "Convert an hourly rate to weekly, monthly and annual pay — and back.",
    metaTitle: "Hourly to Salary Calculator — Convert Wage to Annual Pay",
    metaDescription:
      "Convert an hourly rate into weekly, monthly and yearly pay, or work backwards from a salary. Adjustable hours and weeks. Free.",
    keywords: ["hourly to salary calculator", "wage to salary", "annual salary calculator"],
    processing: "browser",
    related: ["percentage-calculator", "profit-margin-calculator"],
    freeLimit: null,
    faq: [
      { q: "Is this gross or net pay?", a: "Gross — before tax and deductions. Take-home pay depends on where you live." },
      { q: "What if I don't work 52 weeks?", a: "Set the weeks per year to match your unpaid leave and the annual figure adjusts." },
    ],
    live: true,
  },
  {
    slug: "paint-calculator",
    name: "Paint calculator",
    h1: "Paint calculator",
    category: "calculators",
    tagline: "How much paint a room needs, allowing for doors, windows and coats.",
    metaTitle: "Paint Calculator — How Much Paint Do I Need?",
    metaDescription:
      "Work out how many gallons of paint a room needs from wall area, coats, and door and window deductions. Free estimator.",
    keywords: ["paint calculator", "how much paint do i need", "paint coverage calculator"],
    processing: "browser",
    related: ["concrete-calculator", "percentage-calculator"],
    freeLimit: null,
    faq: [
      { q: "What coverage does it assume?", a: "350 square feet per US gallon per coat, typical for primed drywall. Rough or unprimed surfaces drink more — check the tin." },
      { q: "Should I round up?", a: "Yes. Buy whole tins and keep the remainder for touch-ups; a second trip mid-job risks a batch mismatch." },
    ],
    live: true,
  },
  {
    slug: "concrete-calculator",
    name: "Concrete calculator",
    h1: "Concrete calculator",
    category: "calculators",
    tagline: "Cubic yards and premix bags for a slab, with waste allowance.",
    metaTitle: "Concrete Calculator — Cubic Yards & Bags Needed",
    metaDescription:
      "Calculate concrete volume in cubic feet and yards, plus how many 60lb or 80lb bags a slab needs. Includes waste allowance. Free.",
    keywords: ["concrete calculator", "cubic yards of concrete", "how many bags of concrete"],
    processing: "browser",
    related: ["paint-calculator", "percentage-calculator"],
    freeLimit: null,
    faq: [
      { q: "How much waste should I allow?", a: "10% is the default and is typical for a flat slab. Uneven subgrade or awkward forms justify more." },
      { q: "Bags or ready-mix?", a: "Past roughly a cubic yard, bags stop being practical — ordering ready-mix is usually cheaper and far less work." },
      { q: "How many bags per cubic foot?", a: "An 80lb bag yields about 0.6 cubic feet; a 60lb bag about 0.45. Bag counts are always rounded up." },
    ],
    live: true,
  },

  /* ------------------------------------------------------------ image ---- */
  {
    slug: "image-compressor",
    name: "Image compressor",
    h1: "Image compressor",
    category: "image",
    tagline: "Shrink JPG, PNG and WebP files without uploading them.",
    metaTitle: "Image Compressor — Compress JPG, PNG & WebP Free",
    metaDescription:
      "Compress images in your browser with an adjustable quality slider. Batch several at once. Free, no signup, and nothing is uploaded.",
    keywords: ["image compressor", "compress jpg", "compress png", "reduce image size"],
    processing: "browser",
    related: ["image-resizer", "png-to-jpg", "jpg-to-png", "webp-converter"],
    freeLimit: null,
    faq: [
      { q: "Are my images uploaded?", a: "No. Compression uses your browser's own graphics engine, so the image never leaves your device and there is no upload to wait for." },
      { q: "What quality should I use?", a: "80% is a good default for photographs — usually a large size reduction with no visible difference. Drop to 60% for thumbnails." },
      { q: "Why did my PNG get bigger?", a: "PNG is lossless, so re-encoding rarely helps. For photographs, converting to JPG or WebP gives a far smaller file." },
      { q: "Can I compress several at once?", a: "Yes. Add as many as you like and they are processed one after another, then downloaded individually or all together." },
    ],
    live: true,
  },
  {
    slug: "image-resizer",
    name: "Image resizer",
    h1: "Image resizer",
    category: "image",
    tagline: "Resize images by pixel dimensions or percentage, keeping proportions.",
    metaTitle: "Image Resizer — Resize Photos Online Free",
    metaDescription:
      "Resize images by width, height or percentage while keeping proportions. Batch resize in your browser with no upload and no signup.",
    keywords: ["image resizer", "resize image online", "resize photo", "change image dimensions"],
    processing: "browser",
    related: ["image-compressor", "jpg-to-png", "png-to-jpg", "webp-converter"],
    freeLimit: null,
    faq: [
      { q: "Will resizing distort my image?", a: "Not unless you turn off \"keep proportions\". With it on, giving both a width and a height fits the image inside that box rather than stretching it." },
      { q: "Can I make an image larger?", a: "Upscaling is blocked by default because it adds no detail and only makes the file bigger. The original dimensions are used instead." },
      { q: "Which is better, pixels or percentage?", a: "Percentage is easier when you just want everything smaller. Use exact pixels when a platform requires a specific size." },
    ],
    live: true,
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    h1: "JPG to PNG converter",
    category: "image",
    tagline: "Convert JPG photos to PNG in your browser.",
    metaTitle: "JPG to PNG Converter — Free & Private",
    metaDescription:
      "Convert JPG images to PNG instantly in your browser. Batch conversion, no upload, no signup and no watermark on the result.",
    keywords: ["jpg to png", "jpeg to png converter", "convert jpg to png"],
    processing: "browser",
    related: ["png-to-jpg", "webp-converter", "image-compressor", "image-resizer"],
    freeLimit: null,
    faq: [
      { q: "Will converting improve quality?", a: "No. JPG discards detail when it is first saved, and PNG cannot bring that back. It will, however, stop further loss on re-saving." },
      { q: "Why is the PNG bigger than the JPG?", a: "PNG is lossless, so photographs are almost always larger as PNG. That is expected, not a fault." },
      { q: "When should I use PNG?", a: "For screenshots, logos, line art and anything needing transparency or crisp edges. For photographs, JPG or WebP is usually better." },
    ],
    live: true,
  },
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    h1: "PNG to JPG converter",
    category: "image",
    tagline: "Convert PNG images to smaller JPG files.",
    metaTitle: "PNG to JPG Converter — Free, No Upload",
    metaDescription:
      "Convert PNG images to JPG with adjustable quality, right in your browser. Batch convert with no upload, no signup and no watermark.",
    keywords: ["png to jpg", "png to jpeg converter", "convert png to jpg"],
    processing: "browser",
    related: ["jpg-to-png", "image-compressor", "webp-converter", "image-resizer"],
    freeLimit: null,
    faq: [
      { q: "What happens to transparency?", a: "JPG cannot store transparency, so any transparent area is filled with black. If you need transparency, keep the file as PNG or use WebP." },
      { q: "How much smaller will it be?", a: "For photographs, often 70-90% smaller. For flat graphics and screenshots the saving is much less and quality may suffer." },
      { q: "Is any quality lost?", a: "Yes — JPG is lossy. At 80% quality the difference is rarely visible, but each re-save loses a little more." },
    ],
    live: true,
  },
  {
    slug: "webp-converter",
    name: "WebP converter",
    h1: "Convert images to WebP",
    category: "image",
    tagline: "Convert JPG and PNG images to WebP for smaller web pages.",
    metaTitle: "WebP Converter — Convert JPG & PNG to WebP",
    metaDescription:
      "Convert JPG and PNG images to WebP in your browser for noticeably smaller files. Batch convert with no upload and no signup.",
    keywords: ["webp converter", "convert to webp", "jpg to webp", "png to webp"],
    processing: "browser",
    related: ["image-compressor", "png-to-jpg", "jpg-to-png", "image-resizer"],
    freeLimit: null,
    faq: [
      { q: "Why use WebP?", a: "It typically produces files 25-35% smaller than JPG at similar quality, which makes pages load faster. Every current browser supports it." },
      { q: "Does WebP support transparency?", a: "Yes, unlike JPG. That makes it a good replacement for PNG on the web as well as for JPG." },
      { q: "Will old software open it?", a: "Browsers all handle WebP, but some older desktop applications do not. Keep an original if you need to edit it later." },
    ],
    live: true,
  },

  /* -------------------------------------------------------------- pdf ---- */
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    h1: "Merge PDF files",
    category: "pdf",
    tagline: "Combine several PDFs into one, in the order you choose.",
    metaTitle: "Merge PDF — Combine PDF Files Free, No Upload",
    metaDescription:
      "Combine several PDFs into a single document in your browser. Reorder before merging. Free, no signup, and your files are never uploaded.",
    keywords: ["merge pdf", "combine pdf", "join pdf files", "pdf merger"],
    processing: "browser",
    related: ["split-pdf", "delete-pdf-pages", "rotate-pdf", "image-compressor"],
    freeLimit: null,
    faq: [
      { q: "Are my documents uploaded?", a: "No. The merge happens in your browser using a JavaScript PDF library, so contracts and statements never leave your device." },
      { q: "Can I change the order?", a: "Yes. Use the arrows beside each file to move it up or down before merging — they combine in the order shown." },
      { q: "Is there a file size limit?", a: "100 MB per file. Very large documents take longer because your own device does the work rather than a server." },
      { q: "What about password-protected PDFs?", a: "Files with permissions flags usually open fine. A PDF that needs a password to view cannot be merged until you remove it." },
    ],
    live: true,
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    h1: "Split PDF — extract pages",
    category: "pdf",
    tagline: "Pull specific pages out of a PDF into a new document.",
    metaTitle: "Split PDF — Extract Pages From a PDF Free",
    metaDescription:
      "Extract specific pages or ranges from a PDF into a new file, entirely in your browser. Free, no signup, and nothing is uploaded.",
    keywords: ["split pdf", "extract pdf pages", "pdf page extractor"],
    processing: "browser",
    related: ["merge-pdf", "delete-pdf-pages", "rotate-pdf", "pdf-to-jpg"],
    freeLimit: null,
    faq: [
      { q: "How do I choose pages?", a: "Type them like 1-3, 5, 8- where a plain number is one page, a dash is a range, and a trailing dash means through to the end." },
      { q: "Does the original change?", a: "No. A new document is built from the pages you chose and downloaded — the file on your disk is untouched." },
      { q: "Are bookmarks and links kept?", a: "Page content, text and images are copied faithfully. Document-level features like bookmarks and form fields may not survive." },
    ],
    live: true,
  },
  {
    slug: "delete-pdf-pages",
    name: "Delete PDF pages",
    h1: "Delete pages from a PDF",
    category: "pdf",
    tagline: "Remove unwanted pages and keep the rest.",
    metaTitle: "Delete PDF Pages — Remove Pages Free Online",
    metaDescription:
      "Remove unwanted pages from a PDF and download what is left, all in your browser. Free, no signup, and your file is never uploaded.",
    keywords: ["delete pdf pages", "remove pages from pdf", "pdf page remover"],
    processing: "browser",
    related: ["split-pdf", "merge-pdf", "rotate-pdf"],
    freeLimit: null,
    faq: [
      { q: "How do I say which pages to remove?", a: "Type them like 2, 5-7. The tool shows exactly which pages will remain before you commit, so you can check first." },
      { q: "Can I delete every page?", a: "No. The tool refuses rather than producing an empty document, since that is almost never what someone means to do." },
      { q: "Is the original file changed?", a: "Never. A new PDF is created and downloaded; the file on your disk stays exactly as it was." },
    ],
    live: true,
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    h1: "Rotate PDF pages",
    category: "pdf",
    tagline: "Turn sideways or upside-down pages the right way up.",
    metaTitle: "Rotate PDF — Turn Pages Free Online",
    metaDescription:
      "Rotate some or all pages of a PDF by 90, 180 or 270 degrees in your browser. Free, no signup, and the file is never uploaded.",
    keywords: ["rotate pdf", "turn pdf pages", "pdf rotation"],
    processing: "browser",
    related: ["split-pdf", "merge-pdf", "delete-pdf-pages", "compress-pdf"],
    freeLimit: null,
    faq: [
      { q: "Can I rotate only some pages?", a: "Yes. Enter the pages like 1, 3-5 and only those are turned. Leave a scanned document's straight pages alone." },
      { q: "Is the rotation permanent?", a: "It is saved into the new file, so it opens the right way up everywhere — unlike rotating in a viewer, which is usually only a view setting." },
      { q: "What if a page is already rotated?", a: "The turn is applied relative to the page's current rotation, so 90 degrees right always moves it a quarter turn from where it is now." },
    ],
    live: true,
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    h1: "Compress PDF",
    category: "pdf",
    tagline: "Shrink a scanned PDF until it fits an email attachment limit.",
    metaTitle: "Compress PDF \u2014 Reduce PDF File Size Free, No Upload",
    metaDescription:
      "Shrink a scanned PDF in your browser. Pick a quality level, see exactly how much smaller it got, and download only if it actually helped. Nothing is uploaded.",
    keywords: ["compress pdf", "reduce pdf size", "shrink pdf", "pdf compressor"],
    processing: "browser",
    related: ["pdf-to-jpg", "merge-pdf", "split-pdf", "image-compressor"],
    freeLimit: null,
    faq: [
      { q: "How much smaller will my file get?", a: "On a 4.4 MB scan we measured 86% smaller at best quality and 94% at the smallest setting. A PDF that is mostly real text will not shrink at all \u2014 see below." },
      { q: "Why does it warn me about text documents?", a: "Compression works by turning each page into a JPEG. A scan is already pictures, so that is nearly free. A text document is not, and rasterising it usually makes the file much bigger \u2014 in our testing, 225 times bigger." },
      { q: "What happens if the result is bigger than the original?", a: "The tool tells you and does not offer it as a download. Most sites hand the larger file over silently. You can still take it with a second, explicit click if you want it." },
      { q: "Does the text stay selectable?", a: "No. Every page becomes an image, so text can no longer be selected, searched or copied. On a scan there was nothing selectable to begin with, which is why scans are the right input." },
      { q: "Is my document uploaded?", a: "No. The pages are rendered and re-encoded by your own browser, so contracts, statements and medical scans never leave your device." },
    ],
    live: true,
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    h1: "PDF to JPG",
    category: "pdf",
    tagline: "Turn every page of a PDF into a separate JPG image.",
    metaTitle: "PDF to JPG \u2014 Convert PDF Pages to Images Free",
    metaDescription:
      "Turn every page of a PDF into a JPG image, at screen or print resolution, entirely in your browser. Free, no signup, and the PDF is never uploaded.",
    keywords: ["pdf to jpg", "pdf to image", "convert pdf to jpg", "pdf to jpeg"],
    processing: "browser",
    related: ["compress-pdf", "split-pdf", "image-compressor", "merge-pdf"],
    freeLimit: null,
    faq: [
      { q: "What resolution do I get?", a: "Screen renders at roughly 150 dpi, which is right for viewing and sharing. Print renders at roughly 300 dpi \u2014 sharper, and about four times the file size." },
      { q: "Can I download all the pages at once?", a: "Yes. Each page has its own Download button, and Download all saves them in order. Your browser may ask permission once before saving multiple files." },
      { q: "How many pages can it handle?", a: "Up to 200. Beyond that a single browser tab starts to struggle, so split the document first rather than having the page freeze on you." },
      { q: "Are the images uploaded anywhere?", a: "No. Each page is rendered to a canvas inside your browser and encoded there, so the document and the images stay on your device." },
    ],
    live: true,
  },
];

/* ------------------------------------------------------------ helpers ---- */

export const LIVE_TOOLS = TOOLS.filter((t) => t.live);

export function getTool(slug: string): Tool | undefined {
  return LIVE_TOOLS.find((t) => t.slug === slug);
}

export function toolsInCategory(category: CategoryId): Tool[] {
  return LIVE_TOOLS.filter((t) => t.category === category);
}

/**
 * Resolves a tool's related slugs to real, live tools. Falls back to others in
 * the same category so a page is never left with a dead "related" block.
 */
export function relatedTools(tool: Tool, limit = 4): Tool[] {
  const picked = tool.related
    .map((slug) => getTool(slug))
    .filter((t): t is Tool => Boolean(t) && t!.slug !== tool.slug);

  if (picked.length >= limit) return picked.slice(0, limit);

  const filler = toolsInCategory(tool.category).filter(
    (t) => t.slug !== tool.slug && !picked.some((p) => p.slug === t.slug),
  );
  return [...picked, ...filler].slice(0, limit);
}

export function categoryList(): Category[] {
  return (Object.keys(CATEGORIES) as CategoryId[])
    .map((id) => CATEGORIES[id])
    .filter((c) => toolsInCategory(c.id).length > 0);
}
