/**
 * Player totals, derived from the match ledger.
 *
 * Wins, losses and streak used to be adjusted incrementally when a match was
 * confirmed. That cannot be undone: the moment someone logs 6-4 instead of
 * 4-6, there is no way back to the right numbers except to rebuild them. The
 * ledger is the truth, so the totals are recomputed from it — which makes
 * "remove this match" a delete plus a recompute rather than a reversal.
 */

export interface StatMatch {
  player_a: string;
  player_b: string;
  winner_id: string;
  played_at: string;
  created_at: string;
}

export interface DerivedStats {
  wins: number;
  losses: number;
  matches: number;
  /** Positive: consecutive wins. Negative: consecutive losses. */
  streak: number;
}

export function deriveStats(playerId: string, all: StatMatch[]): DerivedStats {
  const mine = all
    .filter((m) => m.player_a === playerId || m.player_b === playerId)
    // Oldest first, so the streak reads from the most recent result backwards.
    .sort(
      (a, b) =>
        new Date(a.played_at).getTime() - new Date(b.played_at).getTime() ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  let wins = 0;
  let losses = 0;
  let streak = 0;

  for (const m of mine) {
    const won = m.winner_id === playerId;
    if (won) wins++;
    else losses++;
    streak = won ? (streak > 0 ? streak + 1 : 1) : streak < 0 ? streak - 1 : -1;
  }

  return { wins, losses, matches: mine.length, streak };
}
