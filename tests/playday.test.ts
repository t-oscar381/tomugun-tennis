import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dateOf,
  dayBounds,
  formatDay,
  isIsoDate,
  jakartaDate,
  playedAtFor,
  relativeDay,
} from "../src/lib/dates.js";
import { cleanName, nameError, nameTaken } from "../src/lib/names.js";
import { PLAYDAY_SQL } from "../src/lib/playday-sql.js";
import { deriveStats, type StatMatch } from "../src/lib/stats.js";
import { flipScore, nightText, tally, type NightMatch } from "../src/lib/summary.js";

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

describe("stats rebuilt from the ledger", () => {
  const m = (a: string, b: string, winner: string, day: number): StatMatch => ({
    player_a: a,
    player_b: b,
    winner_id: winner,
    played_at: `2026-11-${String(day).padStart(2, "0")}T05:00:00Z`,
    created_at: `2026-11-${String(day).padStart(2, "0")}T06:00:00Z`,
  });

  it("counts wins, losses and the current streak", () => {
    const ledger = [m("A", "B", "A", 1), m("A", "C", "C", 2), m("B", "A", "A", 3), m("A", "D", "A", 4)];
    expect(deriveStats("A", ledger)).toEqual({ wins: 3, losses: 1, matches: 4, streak: 2 });
  });

  it("reports a losing run as a negative streak", () => {
    const ledger = [m("A", "B", "A", 1), m("A", "B", "B", 2), m("A", "C", "C", 3)];
    expect(deriveStats("A", ledger).streak).toBe(-2);
  });

  it("is what makes removing a match safe: drop it and the totals follow", () => {
    const wrong = m("A", "B", "A", 5);
    const ledger = [m("A", "B", "B", 1), wrong];
    expect(deriveStats("A", ledger).wins).toBe(1);
    expect(deriveStats("A", ledger.filter((x) => x !== wrong))).toMatchObject({ wins: 0, losses: 1 });
  });

  it("ignores matches the player was not in", () => {
    expect(deriveStats("Z", [m("A", "B", "A", 1)])).toEqual({ wins: 0, losses: 0, matches: 0, streak: 0 });
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

describe("a night's results", () => {
  const n = (id: string, a: string, b: string, winner: string, score: string, t: number): NightMatch => ({
    id, player_a: a, player_b: b, winner_id: winner, scoreline: score, logged_by: "ref",
    created_at: `2026-11-15T1${t}:00:00Z`,
  });
  const names: Record<string, string> = { A: "Andi", B: "Budi", C: "Citra", D: "Dewi" };
  const nameOf = (id: string) => names[id] ?? "?";

  it("tallies played, won and lost per player", () => {
    const rows = tally([n("1", "A", "B", "A", "6-4", 1), n("2", "A", "C", "C", "3-6", 2)], ["A", "B", "C"]);
    expect(rows.find((r) => r.id === "A")).toMatchObject({ played: 2, won: 1, lost: 1 });
    expect(rows.find((r) => r.id === "C")).toMatchObject({ played: 1, won: 1, lost: 0 });
  });

  it("lists someone who is here but hasn't played yet", () => {
    const rows = tally([n("1", "A", "B", "A", "6-4", 1)], ["A", "B", "D"]);
    expect(rows.find((r) => r.id === "D")).toMatchObject({ played: 0, won: 0, lost: 0 });
  });

  it("flips a score to the other side's view", () => {
    expect(flipScore("6-4 3-6 [10-8]")).toBe("4-6 6-3 [8-10]");
    expect(flipScore("7-6(4)")).toBe("6-7(4)");
  });

  it("writes the winner's version of the score into the chat text", () => {
    const text = nightText("2026-11-15", [n("1", "A", "B", "B", "4-6 3-6", 1)], ["A", "B"], nameOf);
    expect(text).toContain("Budi beat Andi 6-4 6-3");
    expect(text).toContain("Budi 1–0");
  });
});

describe("the play-day table", () => {
  it("is in schema.sql exactly as the app shows it", () => {
    // The app displays PLAYDAY_SQL for someone to paste; schema.sql is what a
    // rebuild runs. If they differ, one of them is wrong.
    const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
    expect(schema).toContain(PLAYDAY_SQL.trim());
  });
});
