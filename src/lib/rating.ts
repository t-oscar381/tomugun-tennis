/**
 * The rating pipeline — where a confirmed match becomes ladder movement.
 *
 * Two clocks, deliberately different, exactly as tuned in the simulator
 * (see the rally-rank project's README for the measured behaviour):
 *
 *   RP     — applied the instant a match is confirmed. Immediate feedback is
 *            the whole point of the visible ladder.
 *   Glicko — batched into weekly rating periods. Glicko-2 is defined over a
 *            period containing several results; updating it per match makes
 *            the volatility term meaningless and overreacts to single upsets.
 *
 * So `confirmMatch` moves RP now, and `runRatingPeriods` folds the week's
 * results into MMR later (call it from a cron, or lazily on page load).
 */

import { glicko2Update, winProbability, type Glicko, type GlickoResult } from "./engine/glicko2";
import { RP, applyRp, seedRpFromMmr } from "./engine/ranks";
import { db, ratingPeriodOf, type MatchRow, type PlayerRow } from "./db";

/** How many times these two have already met — drives repeat decay. */
export const REPEAT_DECAY = [1, 1, 0.7, 0.45, 0.3, 0.2];

export function glickoOf(p: PlayerRow): Glicko {
  return { rating: p.rating, rd: p.rd, vol: p.vol };
}

/** Pre-match win probability for `a`, used by the UI and frozen onto the match row. */
export function winChance(a: PlayerRow, b: PlayerRow): number {
  return winProbability(glickoOf(a), glickoOf(b));
}

async function meetingsBetween(aId: string, bId: string): Promise<number> {
  const { count, error } = await db()
    .from("tennis_matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .or(
      `and(player_a.eq.${aId},player_b.eq.${bId}),and(player_a.eq.${bId},player_b.eq.${aId})`,
    );
  if (error) throw new Error(`meetingsBetween: ${error.message}`);
  return count ?? 0;
}

function decayFor(meetings: number): number {
  return REPEAT_DECAY[Math.min(meetings, REPEAT_DECAY.length - 1)]!;
}

export interface ConfirmResult {
  rpDeltaA: number;
  rpDeltaB: number;
  placement: boolean;
}

/**
 * Confirm a pending match and move RP. Idempotent: confirming an already
 * confirmed match is a no-op, so a double-tap on a flaky connection can't
 * pay out twice.
 */
export async function confirmMatch(matchId: string): Promise<ConfirmResult | null> {
  const supabase = db();

  const { data: match, error } = await supabase
    .from("tennis_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(`confirmMatch: ${error.message}`);
  if (!match) return null;

  const m = match as MatchRow;
  if (m.status === "confirmed") {
    return { rpDeltaA: m.rp_delta_a, rpDeltaB: m.rp_delta_b, placement: m.placement };
  }

  const [a, b] = await Promise.all([fetchPlayer(m.player_a), fetchPlayer(m.player_b)]);
  if (!a || !b) throw new Error("confirmMatch: player missing");

  const aWon = m.winner_id === a.id;

  // Placement matches are free — no entry cost, no RP movement — until each
  // player has enough results for the seed to mean anything.
  const aPlacing = a.matches < RP.placementMatches;
  const bPlacing = b.matches < RP.placementMatches;

  const outA = applyRp({
    currentRp: a.rp,
    won: aWon,
    winProbability: m.win_prob_a,
    gamesFor: m.games_a,
    gamesAgainst: m.games_b,
    inPlacements: aPlacing,
  });
  const outB = applyRp({
    currentRp: b.rp,
    won: !aWon,
    winProbability: 1 - m.win_prob_a,
    gamesFor: m.games_b,
    gamesAgainst: m.games_a,
    inPlacements: bPlacing,
  });

  // Repeat decay only ever shrinks a gain; losses always cost full price,
  // otherwise farming the same opponent becomes risk-free.
  const meetings = await meetingsBetween(a.id, b.id);
  const decay = decayFor(meetings);
  const deltaA = outA.delta > 0 ? Math.round(outA.delta * decay) : outA.delta;
  const deltaB = outB.delta > 0 ? Math.round(outB.delta * decay) : outB.delta;

  const nextA = nextPlayerState(a, aWon, deltaA, aPlacing);
  const nextB = nextPlayerState(b, !aWon, deltaB, bPlacing);

  await Promise.all([
    supabase.from("tennis_players").update(nextA).eq("id", a.id),
    supabase.from("tennis_players").update(nextB).eq("id", b.id),
    supabase
      .from("tennis_matches")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        rp_delta_a: aPlacing ? 0 : deltaA,
        rp_delta_b: bPlacing ? 0 : deltaB,
        placement: aPlacing || bPlacing,
      })
      .eq("id", m.id),
  ]);

  return {
    rpDeltaA: aPlacing ? 0 : deltaA,
    rpDeltaB: bPlacing ? 0 : deltaB,
    placement: aPlacing || bPlacing,
  };
}

function nextPlayerState(p: PlayerRow, won: boolean, delta: number, wasPlacing: boolean) {
  const matches = p.matches + 1;
  let rp = wasPlacing ? p.rp : Math.max(0, p.rp + delta);

  // Placements just finished — seed RP from the MMR learned during them, so
  // nobody starts their ranked life from zero.
  if (wasPlacing && matches >= RP.placementMatches) rp = seedRpFromMmr(p.rating);

  return {
    matches,
    wins: p.wins + (won ? 1 : 0),
    losses: p.losses + (won ? 0 : 1),
    streak: won ? (p.streak >= 0 ? p.streak + 1 : 1) : p.streak <= 0 ? p.streak - 1 : -1,
    rp,
    peak_rp: Math.max(p.peak_rp, rp),
  };
}

async function fetchPlayer(id: string): Promise<PlayerRow | null> {
  const { data, error } = await db().from("tennis_players").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`fetchPlayer: ${error.message}`);
  return (data as PlayerRow) ?? null;
}

// ── Glicko-2, batched by week ──────────────────────────────────────────────

export interface RecalcSummary {
  periods: string[];
  matchesRated: number;
  playersUpdated: number;
}

/**
 * Fold every confirmed-but-unrated match into its weekly Glicko-2 rating
 * period, oldest first.
 *
 * Only *closed* periods are processed — the current week keeps accumulating
 * results, and rating it early would double-count those matches when the week
 * finishes. This is why a freshly logged match moves RP immediately but leaves
 * MMR untouched until the following Monday.
 */
export async function runRatingPeriods(groupId: string): Promise<RecalcSummary> {
  const supabase = db();
  const currentPeriod = ratingPeriodOf(new Date());

  const { data, error } = await supabase
    .from("tennis_matches")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "confirmed")
    .is("rated_at", null)
    .lt("rating_period", currentPeriod)
    .order("rating_period", { ascending: true });
  if (error) throw new Error(`runRatingPeriods: ${error.message}`);

  const pending = (data ?? []) as MatchRow[];
  if (pending.length === 0) return { periods: [], matchesRated: 0, playersUpdated: 0 };

  const byPeriod = new Map<string, MatchRow[]>();
  for (const m of pending) {
    const arr = byPeriod.get(m.rating_period);
    if (arr) arr.push(m);
    else byPeriod.set(m.rating_period, [m]);
  }

  const players = new Map<string, PlayerRow>();
  for (const p of await allPlayers(groupId)) players.set(p.id, p);

  const periods = [...byPeriod.keys()].sort();
  let playersUpdated = 0;

  for (const period of periods) {
    const matches = byPeriod.get(period)!;

    // Everyone's rating at the START of the period is the opponent rating used
    // for every result in it. That is what makes it a rating *period* rather
    // than a sequence of pairwise updates.
    const snapshot = new Map<string, Glicko>();
    for (const [id, p] of players) snapshot.set(id, glickoOf(p));

    const results = new Map<string, GlickoResult[]>();
    for (const m of matches) {
      const aG = snapshot.get(m.player_a);
      const bG = snapshot.get(m.player_b);
      if (!aG || !bG) continue;
      const aWon = m.winner_id === m.player_a;
      push(results, m.player_a, { opponent: bG, score: aWon ? 1 : 0 });
      push(results, m.player_b, { opponent: aG, score: aWon ? 0 : 1 });
    }

    const historyRows: Record<string, unknown>[] = [];

    for (const [id, p] of players) {
      const before = snapshot.get(id)!;
      const played = results.get(id) ?? [];

      // Players who sat the week out still get an update: no rating change,
      // but RD widens, so a long absence correctly makes them uncertain again.
      const after = glicko2Update(before, played);

      players.set(id, { ...p, rating: after.rating, rd: after.rd, vol: after.vol });
      playersUpdated++;

      historyRows.push({
        player_id: id,
        rating_period: period,
        rating_before: before.rating,
        rating_after: after.rating,
        rd_before: before.rd,
        rd_after: after.rd,
        rp_after: p.rp,
        played: played.length,
      });
    }

    await Promise.all([
      ...[...players.values()].map((p) =>
        supabase
          .from("tennis_players")
          .update({ rating: p.rating, rd: p.rd, vol: p.vol })
          .eq("id", p.id),
      ),
      supabase
        .from("tennis_rating_history")
        .upsert(historyRows, { onConflict: "player_id,rating_period" }),
      supabase
        .from("tennis_matches")
        .update({ rated_at: new Date().toISOString() })
        .in(
          "id",
          matches.map((m) => m.id),
        ),
    ]);
  }

  return { periods, matchesRated: pending.length, playersUpdated };
}

async function allPlayers(groupId: string): Promise<PlayerRow[]> {
  const { data, error } = await db().from("tennis_players").select("*").eq("group_id", groupId);
  if (error) throw new Error(`allPlayers: ${error.message}`);
  return (data ?? []) as PlayerRow[];
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
