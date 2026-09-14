/**
 * Deterministic prospect scoring (section 25).
 *
 * Scoring runs in code, not in the model, so the same row always produces the
 * same score and the reasoning is auditable. Mercury adds qualitative colour
 * on top -- it never sets the number.
 */
export interface ScorableProspect {
  review_count?: number | null;
  rating?: number | null;
  emergency_service?: boolean | null;
  services?: string[] | null;
  website?: string | null;
  website_quality?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface ScoreBreakdown {
  score: number;
  factors: { factor: string; points: number; reason: string }[];
}

const HIGH_TICKET = ["replacement", "install", "installation", "new system", "commercial"];

export function scoreProspect(p: ScorableProspect): ScoreBreakdown {
  const factors: ScoreBreakdown["factors"] = [];
  const add = (factor: string, points: number, reason: string) =>
    factors.push({ factor, points, reason });

  const reviews = Number(p.review_count ?? 0);
  if (reviews >= 100) add("high_review_count", 20, `${reviews} reviews -- established demand`);
  else if (reviews >= 40) add("high_review_count", 12, `${reviews} reviews -- moderate demand`);
  else if (reviews >= 10) add("high_review_count", 6, `${reviews} reviews`);

  if (p.emergency_service) {
    add("emergency_service", 15, "Offers emergency service -- after-hours calls go unanswered");
  }

  const services = (p.services ?? []).map((s) => s.toLowerCase());
  if (services.some((s) => HIGH_TICKET.some((h) => s.includes(h)))) {
    add("high_ticket_service", 15, "Sells high-ticket jobs -- one missed call is expensive");
  }

  const quality = (p.website_quality ?? "").toLowerCase();
  if (!p.website) add("poor_contact_experience", 15, "No website found -- phone is the only channel");
  else if (quality === "poor") add("poor_contact_experience", 15, "Website rated poor");
  else if (quality === "fair") add("poor_contact_experience", 8, "Website rated fair");

  if (!p.website || quality === "poor" || quality === "fair") {
    add("weak_online_booking", 10, "No credible online booking path");
  }

  if (p.city && p.state) {
    add("service_area_known", 10, `Serves ${p.city}, ${p.state} -- targetable`);
  }

  const rating = Number(p.rating ?? 0);
  if (rating >= 4.3 && reviews >= 25) {
    add("strong_local_demand", 10, `${rating}-star rating with real volume`);
  }

  if (!p.website || quality === "poor") {
    add("no_live_chat", 5, "No live chat -- callers have no fallback");
  }

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), factors };
}

export interface ParsedProspectRow {
  company: string;
  website?: string;
  phone?: string;
  city?: string;
  state?: string;
  industry?: string;
  notes?: string;
}

/**
 * Minimal RFC-4180 CSV parser (handles quoted fields and embedded commas).
 * Written inline rather than adding a dependency, per the cost rule.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return [];

  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])),
  );
}

/** Validates and normalises imported rows; reports why a row was rejected. */
export function normaliseProspectRows(rows: Record<string, string>[]): {
  valid: ParsedProspectRow[];
  rejected: { row: number; reason: string }[];
} {
  const valid: ParsedProspectRow[] = [];
  const rejected: { row: number; reason: string }[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const company = (row.company ?? "").trim();
    if (!company) {
      rejected.push({ row: index + 2, reason: "missing company" });
      return;
    }
    const phone = (row.phone ?? "").replace(/[^\d+]/g, "");
    const key = `${company.toLowerCase()}|${phone}`;
    if (seen.has(key)) {
      rejected.push({ row: index + 2, reason: "duplicate of an earlier row" });
      return;
    }
    seen.add(key);

    valid.push({
      company,
      website: row.website || undefined,
      phone: phone || undefined,
      city: row.city || undefined,
      state: row.state || undefined,
      industry: row.industry || "hvac",
      notes: row.notes || undefined,
    });
  });

  return { valid, rejected };
}
