import type { Appointment, BookingAvailability } from "./types";

/**
 * Internal scheduler (section 13). Pure functions so conflict logic is
 * unit-testable without a database or a calendar provider.
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/** Half-open overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

const BLOCKING_STATUSES = new Set(["scheduled", "confirmed"]);

/**
 * Returns the first booking that conflicts, or null. Cancelled and no-show
 * appointments free their slot; completed ones still occupy their past time.
 */
export function findConflict(
  candidate: TimeRange,
  existing: Pick<Appointment, "id" | "start_time" | "end_time" | "status">[],
  blackouts: TimeRange[] = [],
): { kind: "appointment" | "blackout"; id?: string } | null {
  for (const appt of existing) {
    if (!BLOCKING_STATUSES.has(appt.status)) continue;
    const range = {
      start: new Date(appt.start_time),
      end: new Date(appt.end_time),
    };
    if (overlaps(candidate, range)) return { kind: "appointment", id: appt.id };
  }
  for (const blackout of blackouts) {
    if (overlaps(candidate, blackout)) return { kind: "blackout" };
  }
  return null;
}

function parseHHMM(value: string): { hours: number; minutes: number } {
  const [h, m] = value.split(":");
  return { hours: Number(h) || 0, minutes: Number(m) || 0 };
}

/**
 * Generates candidate slots over the next `days` days.
 *
 * Timezone note: slot boundaries are derived in UTC from the availability
 * window. A business in a non-UTC zone should have `booking_availability`
 * expressed accordingly. Proper per-timezone handling is called out as a
 * known limitation in docs/ARCHITECTURE.md rather than being faked here.
 */
export function generateSlots(input: {
  availability: BookingAvailability;
  durationMinutes: number;
  from: Date;
  days: number;
  existing: Pick<Appointment, "id" | "start_time" | "end_time" | "status">[];
  blackouts?: TimeRange[];
  limit?: number;
}): TimeRange[] {
  const slots: TimeRange[] = [];
  const limit = input.limit ?? 5;
  const durationMs = input.durationMinutes * 60_000;
  const open = parseHHMM(input.availability.start);
  const close = parseHHMM(input.availability.end);

  for (let dayOffset = 0; dayOffset < input.days && slots.length < limit; dayOffset++) {
    const day = new Date(input.from);
    day.setUTCDate(day.getUTCDate() + dayOffset);

    // JS getUTCDay(): 0 = Sunday. Availability uses ISO 1 = Monday .. 7 = Sunday.
    const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    if (!input.availability.days.includes(isoWeekday)) continue;

    const dayStart = new Date(day);
    dayStart.setUTCHours(open.hours, open.minutes, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setUTCHours(close.hours, close.minutes, 0, 0);

    for (
      let cursor = new Date(Math.max(dayStart.getTime(), input.from.getTime()));
      cursor.getTime() + durationMs <= dayEnd.getTime() && slots.length < limit;
      cursor = new Date(cursor.getTime() + durationMs)
    ) {
      const candidate = {
        start: new Date(cursor),
        end: new Date(cursor.getTime() + durationMs),
      };
      if (!findConflict(candidate, input.existing, input.blackouts)) {
        slots.push(candidate);
      }
    }
  }
  return slots;
}
