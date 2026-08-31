import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationBadge } from "@/components/ui/signal";
import type { VerificationStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Verification levels" };

const LEVELS: Array<{
  status: VerificationStatus;
  meaning: string;
  treatment: string;
}> = [
  {
    status: "VERIFIED_MANUFACTURER",
    meaning: "Taken from the manufacturer's own published documentation, with the source recorded.",
    treatment: "Authoritative. The only level treated as definitive anywhere in the application.",
  },
  {
    status: "VERIFIED_DISTRIBUTOR",
    meaning: "Taken from an authorised distributor listing.",
    treatment: "Usable, but never authoritative. Lowers the documentation score of any build using it.",
  },
  {
    status: "SECONDARY_SOURCE",
    meaning: "Taken from a secondary source such as a review or an aggregator.",
    treatment: "Indicative only. Compatibility results that depend on it are reported at this confidence.",
  },
  {
    status: "USER_SUBMITTED",
    meaning: "Submitted by a user and not yet checked against a manufacturer source.",
    treatment: "Shown with the label attached; never used to upgrade a result to compatible on its own.",
  },
  {
    status: "UNVERIFIED",
    meaning: "No source recorded.",
    treatment: "Flagged by the data quality engine and surfaced in the admin dashboard for review.",
  },
];

export default function VerificationPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verification levels</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Every specification, dimension and compatibility rule carries a provenance level. The
          level travels with the value: a compatibility result is reported at the weakest level
          among the rule and the two products it compared.
        </p>
      </header>

      <div className="space-y-3">
        {LEVELS.map((level) => (
          <Card key={level.status}>
            <CardContent className="p-4">
              <VerificationBadge status={level.status} />
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{level.meaning}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{level.treatment}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold">Missing specifications</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            When a manufacturer does not publish a value, BuildSight displays &ldquo;Not provided by
            manufacturer.&rdquo; It is never interpolated from a similar product, inferred from a
            photograph or estimated from a category average. Downstream, the missing value produces
            an UNKNOWN compatibility result or a withheld measurement rather than a confident-looking
            number.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
