import { describe, expect, it } from "vitest";
import {
  dateOf,
  dayBounds,
  formatDay,
  formatTime,
  isIsoDate,
  jakartaDate,
  playedAtFor,
  relativeDay,
  shiftDate,
} from "../src/lib/dates.js";
import { cleanName, nameError, nameTaken } from "../src/lib/names.js";

describe("Jakarta dates", () => {
  it("files a Sunday-morning game under Sunday, not under UTC's Saturday", () => {
    // 06:30 Sunday in Jakarta is 23:30 Saturday UTC.
    expect(jakartaDate(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
    expect(dateOf("2026-11-14T23:30:00Z")).toBe("2026-11-15");
  });

  it("stores a play day's matches at midday so they stay inside the day", () => {
    const at = playedAtFor("2026-11-15");
    expect(dateOf(at)).toBe("2026-11-15");
    const { start, end } = dayBounds("2026-11-15");
    expect(at >= start && at < end).toBe(true);
  });

  it("brackets exactly 24 hours", () => {
    const { start, end } = dayBounds("2026-11-15");
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(24 * 3600 * 1000);
    expect(start).toBe("2026-11-14T17:00:00.000Z");
  });

  it("rejects impossible dates", () => {
    expect(isIsoDate("2026-11-15")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("15/11/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("says Today and Yesterday where that is the useful word", () => {
    const now = new Date("2026-11-15T05:00:00Z");
    expect(relativeDay("2026-11-15", now)).toBe("Today");
    expect(relativeDay("2026-11-14", now)).toBe("Yesterday");
    expect(relativeDay("2026-11-01", now)).toBe(formatDay("2026-11-01"));
  });
});

describe("moving between days", () => {
  it("steps a date forwards and backwards, across month and year ends", () => {
    expect(shiftDate("2026-11-16", -1)).toBe("2026-11-15");
    expect(shiftDate("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("shows a game's time in Jakarta, not UTC", () => {
    expect(formatTime("2026-11-16T12:45:00Z")).toBe("19:45");
  });
});

describe("names", () => {
  const roster = [{ id: "1", name: "Dimas" }, { id: "2", name: "A" }];

  it("treats dimas and Dimas as the same person", () => {
    expect(nameTaken(roster, "dimas")).toBe(true);
    expect(nameTaken(roster, "DIMAS")).toBe(true);
  });

  it("lets you rename to a different case of your own name", () => {
    expect(nameTaken(roster, "dimas", "1")).toBe(false);
  });

  it("tidies whitespace and enforces length", () => {
    expect(cleanName("  Budi   Santoso ")).toBe("Budi Santoso");
    expect(nameError("")).not.toBeNull();
    expect(nameError("x".repeat(25))).not.toBeNull();
    expect(nameError("Budi")).toBeNull();
  });
});

import { hasChosenFace, petOf, petValue } from "../src/lib/pets";

describe("pets", () => {
  it("round-trips a chosen pet through the stored value", () => {
    expect(petOf(petValue("corgi"))).toBe("corgi");
    expect(hasChosenFace(petValue("corgi"))).toBe(true);
  });
  it("treats the default emoji as not having chosen yet", () => {
    expect(petOf("🎾")).toBeNull();
    expect(hasChosenFace("🎾")).toBe(false);
  });
  it("remembers a skip, and never stores an unknown pet", () => {
    expect(petOf(petValue("none"))).toBeNull();
    expect(hasChosenFace(petValue("none"))).toBe(true);
    expect(petValue("../etc")).toBe("initials");
  });
});
