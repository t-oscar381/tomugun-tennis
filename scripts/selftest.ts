/**
 * Production smoke test.
 *
 * Exercises the real write path — parse a scoreline, insert a pending match,
 * confirm it, move RP, then fold a closed week into Glicko-2 — using the same
 * functions the app calls. Read-only checks can't prove any of that works.
 *
 * It creates its own throwaway group and deletes it at the end (every child
 * row cascades), so it never touches a real league even when pointed at
 * production.
 *
 *   npm run selftest
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, getPlayer, ratingPeriodOf, type PlayerRow } from "../src/lib/db";
import { FORMATS } from "../src/lib/engine/tennis";
import { parseScoreline } from "../src/lib/engine/scoreline";
import { RP, rankFromRp } from "../src/lib/engine/ranks";
import { confirmMatch, runRatingPeriods, winChance } from "../src/lib/rating";

const SLUG = `selftest-${Date.now()}`;
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const supabase = db();
  console.log(`\nSupabase: ${(process.env.SUPABASE_URL ?? "").replace(/^https:\/\//, "")}`);
  console.log(`Throwaway group: ${SLUG}\n`);

  // ── 1. Connectivity + schema ────────────────────────────────────────────
  const { data: group, error: gErr } = await supabase
    .from("tennis_groups")
    .insert({ slug: SLUG, name: "Self test", join_code: "TESTCODE" })
    .select("*")
    .single();
  check("connect + create group", !gErr && !!group, gErr?.message ?? "");
  if (!group) return finish();

  const groupId = group.id as string;

  try {
    // ── 2. Players ────────────────────────────────────────────────────────
    const mk = async (name: string) => {
      const { data, error } = await supabase
        .from("tennis_players")
        .insert({ group_id: groupId, name })
        .select("*")
        .single();
      if (error) throw new Error(`create ${name}: ${error.message}`);
      return data as PlayerRow;
    };
    let a = await mk("Alpha");
    let b = await mk("Bravo");
    check("create players", !!a.id && !!b.id);
    check("players start unranked", a.rp === 0 && a.matches === 0);
    check("players start at default MMR", a.rating === 1500 && a.rd === 350);

    // ── 3. Scoreline validation is actually wired in ──────────────────────
    const bad = parseScoreline("6-5 6-3", FORMATS.bestOf3MatchTB);
    check("rejects an impossible score", !bad.ok, bad.ok ? "" : bad.error);

    // ── 4. Log + confirm, repeatedly, through placements and out ──────────
    // Placements are free, so RP only moves from match 6 onward. Play enough
    // to cross that boundary and prove both behaviours.
    const scores = [
      "6-4 6-3",
      "6-2 3-6 [10-7]",
      "7-6(4) 6-4",
      "6-1 6-2",
      "4-6 6-3 [10-8]",
      "6-3 6-4",
      "6-4 7-5",
    ];

    let firstRankedDelta: number | null = null;

    for (let i = 0; i < scores.length; i++) {
      const raw = scores[i]!;
      const parsed = parseScoreline(raw, FORMATS.bestOf3MatchTB);
      if (!parsed.ok) throw new Error(`fixture ${raw} rejected: ${parsed.error}`);

      const aWon = parsed.value.winner === "A";
      // Back-date the early matches into closed weeks so the Glicko pass has
      // something to rate; keep the last two in the current week.
      const daysAgo = i < scores.length - 2 ? 21 - i * 3 : 0;
      const playedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

      const { data: match, error } = await supabase
        .from("tennis_matches")
        .insert({
          group_id: groupId,
          player_a: a.id,
          player_b: b.id,
          winner_id: aWon ? a.id : b.id,
          sets: parsed.value.sets,
          scoreline: raw,
          games_a: parsed.value.gamesA,
          games_b: parsed.value.gamesB,
          win_prob_a: winChance(a, b),
          logged_by: a.id,
          rating_period: ratingPeriodOf(playedAt),
          played_at: playedAt.toISOString(),
        })
        .select("*")
        .single();
      if (error) throw new Error(`insert match ${i}: ${error.message}`);

      if (i === 0) {
        check("match stored as pending", match.status === "pending", `got ${match.status}`);
        const beforeRp = a.rp;
        const refetched = await getPlayer(a.id);
        check("pending match moves nothing", refetched?.rp === beforeRp);
      }

      const rpBefore = (await getPlayer(a.id))!.rp;
      const result = await confirmMatch(match.id as string);
      check(`confirm match ${i + 1}`, result !== null);

      a = (await getPlayer(a.id))!;
      b = (await getPlayer(b.id))!;

      if (i === 0) {
        check("placement match awards no RP", a.rp === rpBefore && result?.placement === true);
        // Idempotency: a double-tap on a flaky connection must not pay twice.
        const rpAfterFirst = a.rp;
        const winsAfterFirst = a.wins;
        await confirmMatch(match.id as string);
        const again = (await getPlayer(a.id))!;
        check(
          "re-confirming is a no-op",
          again.rp === rpAfterFirst && again.wins === winsAfterFirst,
        );
      }

      if (a.matches === RP.placementMatches) {
        check("RP seeded when placements finish", a.rp > 0, `seeded ${a.rp}`);
      }

      if (a.matches > RP.placementMatches && firstRankedDelta === null) {
        firstRankedDelta = result?.rpDeltaA ?? 0;
        check("ranked match moves RP", firstRankedDelta !== 0, `delta ${firstRankedDelta}`);
      }
    }

    check("match counts tally", a.matches === scores.length, `a played ${a.matches}`);
    check("wins + losses == matches", a.wins + a.losses === a.matches);
    check("rank label renders", typeof rankFromRp(a.rp).label === "string", rankFromRp(a.rp).label);

    // ── 5. Glicko-2 weekly rating periods ─────────────────────────────────
    const mmrBefore = a.rating;
    const rdBefore = a.rd;
    const summary = await runRatingPeriods(groupId);
    a = (await getPlayer(a.id))!;

    check("rating periods processed", summary.periods.length > 0, `${summary.periods.length} weeks`);
    check("MMR moved off the default", a.rating !== mmrBefore, `${Math.round(a.rating)}`);
    check("RD narrowed with evidence", a.rd < rdBefore, `${Math.round(rdBefore)} → ${Math.round(a.rd)}`);
    check("winner rated above loser", a.rating > b.rating || b.wins > a.wins);

    const { data: hist } = await supabase
      .from("tennis_rating_history")
      .select("rating_period")
      .eq("player_id", a.id);
    check("rating history written", (hist?.length ?? 0) > 0, `${hist?.length ?? 0} rows`);

    // Idempotent: rerunning must not double-rate the same weeks.
    const mmrAfter = a.rating;
    const rerun = await runRatingPeriods(groupId);
    a = (await getPlayer(a.id))!;
    check("rerun rates nothing new", rerun.matchesRated === 0 && a.rating === mmrAfter);

    console.log(
      `\n  Final: Alpha ${Math.round(a.rp)} RP (${rankFromRp(a.rp).label}), ` +
        `mmr ${Math.round(a.rating)} ±${Math.round(a.rd)}, ${a.wins}-${a.losses}`,
    );
  } finally {
    // Cascade wipes players, matches and rating history with the group.
    const { error } = await supabase.from("tennis_groups").delete().eq("id", groupId);
    check("cleaned up throwaway group", !error, error?.message ?? "");
  }

  finish();
}

function finish(): void {
  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nSelf-test threw:", e instanceof Error ? e.message : e);
  process.exit(1);
});
