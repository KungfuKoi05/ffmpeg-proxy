import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompatibilityState, SignalState, VerificationStatus } from "@/lib/types";
import { VERIFICATION_LABELS } from "@/lib/catalog/vocabulary";

/**
 * The product's shared visual vocabulary.
 *
 * GREEN verified compatible, YELLOW conditional or insufficient information,
 * RED documented conflict, GRAY unknown. Compatibility state, clearance state
 * and verification level all funnel through these three components so a colour
 * never means two different things.
 */

const COMPATIBILITY_TONE: Record<CompatibilityState, "green" | "yellow" | "red" | "gray"> = {
  COMPATIBLE: "green",
  CONDITIONAL: "yellow",
  INCOMPATIBLE: "red",
  UNKNOWN: "gray",
};

const COMPATIBILITY_LABEL: Record<CompatibilityState, string> = {
  COMPATIBLE: "Compatible",
  CONDITIONAL: "Conditional",
  INCOMPATIBLE: "Incompatible",
  UNKNOWN: "Unknown",
};

export function CompatibilityBadge({
  state,
  className,
}: {
  state: CompatibilityState;
  className?: string;
}) {
  return (
    <Badge tone={COMPATIBILITY_TONE[state]} className={className}>
      <SignalDot state={SIGNAL_FOR_COMPATIBILITY[state]} />
      {COMPATIBILITY_LABEL[state]}
    </Badge>
  );
}

export const SIGNAL_FOR_COMPATIBILITY: Record<CompatibilityState, SignalState> = {
  COMPATIBLE: "GREEN",
  CONDITIONAL: "YELLOW",
  INCOMPATIBLE: "RED",
  UNKNOWN: "GRAY",
};

const SIGNAL_CLASS: Record<SignalState, string> = {
  GREEN: "bg-signal-green",
  YELLOW: "bg-signal-yellow",
  RED: "bg-signal-red",
  GRAY: "bg-signal-gray",
};

export function SignalDot({ state, className }: { state: SignalState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 rounded-full", SIGNAL_CLASS[state], className)}
    />
  );
}

const SIGNAL_TONE: Record<SignalState, "green" | "yellow" | "red" | "gray"> = {
  GREEN: "green",
  YELLOW: "yellow",
  RED: "red",
  GRAY: "gray",
};

export function ClearanceBadge({ state, label }: { state: SignalState; label?: string }) {
  const text =
    label ??
    { GREEN: "Clear", YELLOW: "Tight", RED: "Conflict", GRAY: "Unknown" }[state];
  return (
    <Badge tone={SIGNAL_TONE[state]}>
      <SignalDot state={state} />
      {text}
    </Badge>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, "green" | "blue" | "yellow" | "gray"> = {
  VERIFIED_MANUFACTURER: "green",
  VERIFIED_DISTRIBUTOR: "blue",
  SECONDARY_SOURCE: "yellow",
  USER_SUBMITTED: "yellow",
  UNVERIFIED: "gray",
};

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  return (
    <Badge tone={VERIFICATION_TONE[status]} className={className} title={verificationHelp(status)}>
      {VERIFICATION_LABELS[status] ?? status}
    </Badge>
  );
}

export function verificationHelp(status: VerificationStatus): string {
  switch (status) {
    case "VERIFIED_MANUFACTURER":
      return "Specification taken from the manufacturer's own published documentation. Authoritative.";
    case "VERIFIED_DISTRIBUTOR":
      return "Specification taken from an authorised distributor listing. Not authoritative.";
    case "SECONDARY_SOURCE":
      return "Specification taken from a secondary source. Treat as indicative only.";
    case "USER_SUBMITTED":
      return "Submitted by a user and not yet verified against a manufacturer source.";
    default:
      return "No source recorded. Not verified.";
  }
}
