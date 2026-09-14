/**
 * Platform-wide kill switches (section 27). These are deliberately env-driven
 * so an operator can disable a misbehaving integration without a code change.
 * Per-business switches live on the businesses row and are checked separately.
 */
export type FeatureFlag =
  | "AI_ENABLED"
  | "VOICE_ENABLED"
  | "SMS_ENABLED"
  | "BOOKING_ENABLED"
  | "OUTBOUND_FOLLOWUP_ENABLED"
  | "PROSPECTING_ENABLED";

/** Flags default ON; set the env var to "false" (or "0") to disable. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const raw = process.env[flag];
  if (raw === undefined) return true;
  return raw !== "false" && raw !== "0";
}

export function allFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags: FeatureFlag[] = [
    "AI_ENABLED",
    "VOICE_ENABLED",
    "SMS_ENABLED",
    "BOOKING_ENABLED",
    "OUTBOUND_FOLLOWUP_ENABLED",
    "PROSPECTING_ENABLED",
  ];
  return Object.fromEntries(flags.map((f) => [f, isFeatureEnabled(f)])) as Record<
    FeatureFlag,
    boolean
  >;
}
