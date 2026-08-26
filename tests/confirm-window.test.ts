import { describe, expect, it } from "vitest";
import { CONFIRM_WINDOW_HOURS, hoursLeftToConfirm } from "../src/lib/rating.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe("dispute window", () => {
  it("gives a fresh match the full window", () => {
    expect(hoursLeftToConfirm(hoursAgo(0))).toBe(CONFIRM_WINDOW_HOURS);
  });

  it("counts down as time passes", () => {
    expect(hoursLeftToConfirm(hoursAgo(10))).toBe(CONFIRM_WINDOW_HOURS - 10);
  });

  it("never goes negative once the window has closed", () => {
    // The UI renders this number directly, so a negative would read as
    // "counts automatically in -12h".
    expect(hoursLeftToConfirm(hoursAgo(CONFIRM_WINDOW_HOURS + 12))).toBe(0);
  });

  it("hits zero exactly at the boundary", () => {
    expect(hoursLeftToConfirm(hoursAgo(CONFIRM_WINDOW_HOURS))).toBe(0);
  });

  it("rounds up, so 'in 1h' never means 'already expired'", () => {
    expect(hoursLeftToConfirm(hoursAgo(CONFIRM_WINDOW_HOURS - 0.2))).toBe(1);
  });
});
