import { dateOf, formatDay } from "./dates";

/** The minimum a night's results need — keeps this independent of the DB row type. */
export interface NightMatch {
  id: string;
  player_a: string;
  player_b: string;
  winner_id: string;
  scoreline: string;
  logged_by: string;
  created_at: string;
}

export interface Tally {
  id: string;
  played: number;
  won: number;
  lost: number;
}

/**
 * Per-player totals for one night, for everyone who is here or has played.
 * Someone ticked present who has not played yet is still listed, at 0–0:
 * the table doubles as the "who's here" roll.
 */
export function tally(matches: NightMatch[], presentIds: string[]): Tally[] {
  const rows = new Map<string, Tally>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { id, played: 0, won: 0, lost: 0 }));
    return r;
  };

  for (const id of presentIds) row(id);
  for (const m of matches) {
    const a = row(m.player_a);
    const b = row(m.player_b);
    a.played++;
    b.played++;
    if (m.winner_id === m.player_a) {
      a.won++;
      b.lost++;
    } else {
      b.won++;
      a.lost++;
    }
  }

  return [...rows.values()].sort((x, y) => y.won - x.won || x.lost - y.lost || y.played - x.played);
}

/** "6-4 3-6 [10-8]" as the other side reads it. */
export function flipScore(scoreline: string): string {
  return scoreline
    .split(" ")
    .map((t) => {
      const tb = /^\[(\d+)-(\d+)\]$/.exec(t);
      if (tb) return `[${tb[2]}-${tb[1]}]`;
      const m = /^(\d+)-(\d+)(\(\d+\))?$/.exec(t);
      return m ? `${m[2]}-${m[1]}${m[3] ?? ""}` : t;
    })
    .join(" ");
}

/** Plain text for pasting into the group chat. */
export function nightText(
  date: string,
  matches: NightMatch[],
  presentIds: string[],
  nameOf: (id: string) => string,
): string {
  const lines = [`🎾 ${formatDay(date)} — ${matches.length} ${matches.length === 1 ? "match" : "matches"}`];

  for (const m of [...matches].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const loser = m.winner_id === m.player_a ? m.player_b : m.player_a;
    const score = m.winner_id === m.player_a ? m.scoreline : flipScore(m.scoreline);
    lines.push(`${nameOf(m.winner_id)} beat ${nameOf(loser)} ${score}`);
  }

  const rows = tally(matches, presentIds).filter((r) => r.played > 0);
  if (rows.length) {
    lines.push("", "Tonight:");
    for (const r of rows) lines.push(`${nameOf(r.id)} ${r.won}–${r.lost}`);
  }
  return lines.join("\n");
}

/** Which play day a match belongs to. */
export function nightOf(playedAt: string): string {
  return dateOf(playedAt);
}
