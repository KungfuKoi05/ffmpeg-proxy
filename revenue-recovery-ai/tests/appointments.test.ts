import { describe, expect, it } from "vitest";
import { findConflict, generateSlots, overlaps } from "@/lib/appointments";
import type { AppointmentStatus } from "@/lib/types";

const appt = (start: string, end: string, status: AppointmentStatus = "scheduled") => ({
  id: `${start}-${end}`,
  start_time: start,
  end_time: end,
  status,
});

describe("overlaps", () => {
  it("treats ranges as half-open so back-to-back slots do not collide", () => {
    const a = { start: new Date("2026-09-01T09:00:00Z"), end: new Date("2026-09-01T11:00:00Z") };
    const b = { start: new Date("2026-09-01T11:00:00Z"), end: new Date("2026-09-01T13:00:00Z") };
    expect(overlaps(a, b)).toBe(false);
  });

  it("detects partial overlap", () => {
    const a = { start: new Date("2026-09-01T09:00:00Z"), end: new Date("2026-09-01T11:00:00Z") };
    const b = { start: new Date("2026-09-01T10:00:00Z"), end: new Date("2026-09-01T12:00:00Z") };
    expect(overlaps(a, b)).toBe(true);
  });
});

describe("findConflict", () => {
  const candidate = {
    start: new Date("2026-09-01T09:00:00Z"),
    end: new Date("2026-09-01T11:00:00Z"),
  };

  it("reports a conflict against a scheduled appointment", () => {
    const conflict = findConflict(candidate, [
      appt("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
    ]);
    expect(conflict?.kind).toBe("appointment");
  });

  it("ignores cancelled and no-show appointments", () => {
    expect(
      findConflict(candidate, [
        appt("2026-09-01T09:30:00Z", "2026-09-01T11:30:00Z", "cancelled"),
        appt("2026-09-01T09:30:00Z", "2026-09-01T11:30:00Z", "no_show"),
      ]),
    ).toBeNull();
  });

  it("reports blackout conflicts", () => {
    const conflict = findConflict(candidate, [], [
      { start: new Date("2026-09-01T08:00:00Z"), end: new Date("2026-09-01T10:00:00Z") },
    ]);
    expect(conflict?.kind).toBe("blackout");
  });

  it("returns null when the slot is free", () => {
    expect(
      findConflict(candidate, [appt("2026-09-01T13:00:00Z", "2026-09-01T15:00:00Z")]),
    ).toBeNull();
  });
});

describe("generateSlots", () => {
  const availability = { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" };

  it("only offers slots on configured days", () => {
    // 2026-09-05 is a Saturday.
    const slots = generateSlots({
      availability: { days: [6], start: "08:00", end: "12:00" },
      durationMinutes: 120,
      from: new Date("2026-09-04T00:00:00Z"),
      days: 3,
      existing: [],
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start.getUTCDay()).toBe(6);
    }
  });

  it("never returns a slot that conflicts with an existing appointment", () => {
    const from = new Date("2026-09-01T00:00:00Z"); // Tuesday
    const existing = [appt("2026-09-01T08:00:00Z", "2026-09-01T10:00:00Z")];
    const slots = generateSlots({
      availability,
      durationMinutes: 120,
      from,
      days: 1,
      existing,
      limit: 10,
    });
    for (const slot of slots) {
      expect(findConflict(slot, existing)).toBeNull();
    }
  });

  it("respects the requested limit", () => {
    const slots = generateSlots({
      availability,
      durationMinutes: 60,
      from: new Date("2026-09-01T00:00:00Z"),
      days: 5,
      existing: [],
      limit: 3,
    });
    expect(slots).toHaveLength(3);
  });

  it("never offers a slot that ends after closing time", () => {
    const slots = generateSlots({
      availability: { days: [1, 2, 3, 4, 5], start: "08:00", end: "09:00" },
      durationMinutes: 120,
      from: new Date("2026-09-01T00:00:00Z"),
      days: 5,
      existing: [],
    });
    expect(slots).toHaveLength(0);
  });
});
