/**
 * Seed a demo league — and, in passing, an end-to-end test of the real thing.
 *
 * This deliberately does NOT write ratings directly. It inserts matches as
 * `pending` and then calls the same confirmMatch / runRatingPeriods code the
 * app uses, so a successful run proves the whole pipeline works against the
 * live database: scoreline parsing, RP entry costs, repeat decay, placement
 * seeding, and weekly Glicko-2 rating periods.
 *
 *   npm run seed            14 weeks, 8 players
 *   npm run seed -- --weeks 6 --wipe
 *
 * --wipe clears existing players and matches for the group first. It only ever
 * touches `tennis_` tables for this one group, never anything belonging to the
 * wedding app that shares this Supabase project.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, getGroupBySlug, ratingPeriodOf } from "../src/lib/db";
import { FORMATS } from "../src/lib/engine/tennis";
import { GROUP_SLUG } from "../src/lib/league";
import { confirmMatch, runRatingPeriods, winChance } from "../src/lib/rating";
import { simulateMatch } from "./sim/match";
import { mulberry32, shuffle } from "./sim/rng";

interface Seed {
  name: string;
  emoji: string;
  trueSkill: number;
  consistency: number;
  attendance: number;
}

// The same archetypes the rally-rank simulator was tuned against, so the demo
// ladder should sort roughly into this order.
const ROSTER: Seed[] = [
  { name: "Andre", emoji: "🎾", trueSkill: 1760, consistency: 30, attendance: 0.9 },
  { name: "Bimo", emoji: "🔥", trueSkill: 1680, consistency: 75, attendance: 0.85 },
  { name: "Cakra", emoji: "🧊", trueSkill: 1640, consistency: 35, attendance: 0.95 },
  { name: "Dimas", emoji: "📈", trueSkill: 1600, consistency: 45, attendance: 0.9 },
  { name: "Eka", emoji: "🌙", trueSkill: 1540, consistency: 55, attendance: 0.6 },
  { name: "Fajar", emoji: "⚖️", trueSkill: 1490, consistency: 40, attendance: 0.9 },
  { name: "Gilang", emoji: "🎲", trueSkill: 1420, consistency: 70, attendance: 0.85 },
  { name: "Hendra", emoji: "🌱", trueSkill: 1330, consistency: 30, attendance: 0.95 },
];

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const WEEKS = flag("weeks", 14);
const WIPE = args.includes("--wipe");

async function main() {
  const supabase = db();

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) {
    console.error(
      `No group "${GROUP_SLUG}". Run supabase/schema.sql against the project first.`,
    );
    process.exit(1);
  }
  console.log(`League: ${group.name} (${group.slug})`);

  if (WIPE) {
    await supabase.from("tennis_matches").delete().eq("group_id", group.id);
    const { data: old } = await supabase
      .from("tennis_players")
      .select("id")
      .eq("group_id", group.id);
    for (const p of old ?? []) {
      await supabase.from("tennis_rating_history").delete().eq("player_id", p.id);
    }
    await supabase.from("tennis_players").delete().eq("group_id", group.id);
    console.log("Wiped existing players and matches.");
  }

  // Players.
  const ids = new Map<string, string>();
  for (const s of ROSTER) {
    const { data, error } = await supabase
      .from("tennis_players")
      .upsert(
        { group_id: group.id, name: s.name, emoji: s.emoji },
        { onConflict: "group_id,name" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`insert ${s.name}: ${error.message}`);
    ids.set(s.name, data.id as string);
  }
  console.log(`${ROSTER.length} players ready.`);

  const rand = mulberry32(20260803);
  const format = FORMATS.bestOf3MatchTB;
  let logged = 0;

  for (let week = WEEKS; week >= 1; week--) {
    // Back-date so earlier weeks are closed rating periods that the Glicko
    // pass will actually process. Only fully past weeks get rated.
    const playedAt = new Date(Date.now() - week * 7 * 24 * 3600 * 1000);
    const period = ratingPeriodOf(playedAt);

    const attending = shuffle(
      ROSTER.filter((s) => rand() < s.attendance),
      rand,
    );

    for (let round = 0; round < 2; round++) {
      const pool = shuffle(attending, rand);
      for (let i = 0; i + 1 < pool.length; i += 2) {
        const A = pool[i]!;
        const B = pool[i + 1]!;

        const sim = simulateMatch(
          { trueSkill: A.trueSkill, consistency: A.consistency },
          { trueSkill: B.trueSkill, consistency: B.consistency },
          rand,
          format,
        );
        const aWon = sim.winner === "A";
        const games = sim.match.gamesWon();

        const aId = ids.get(A.name)!;
        const bId = ids.get(B.name)!;

        // Win probability has to come from the players' CURRENT ratings, the
        // same way the app freezes it at log time.
        const [pa, pb] = await Promise.all([fetch1(aId), fetch1(bId)]);

        const { data, error } = await supabase
          .from("tennis_matches")
          .insert({
            group_id: group.id,
            player_a: aId,
            player_b: bId,
            winner_id: aWon ? aId : bId,
            sets: sim.match.sets,
            scoreline: sim.match.scoreline(),
            games_a: games.a,
            games_b: games.b,
            win_prob_a: winChance(pa, pb),
            logged_by: aId,
            rating_period: period,
            played_at: playedAt.toISOString(),
          })
          .select("id")
          .single();
        if (error) throw new Error(`insert match: ${error.message}`);

        // The real confirmation path — this is what moves RP.
        await confirmMatch(data.id as string);
        logged++;
      }
    }
  }

  console.log(`${logged} matches logged and confirmed.`);

  const summary = await runRatingPeriods(group.id);
  console.log(
    `Glicko-2: rated ${summary.matchesRated} matches across ${summary.periods.length} weekly periods.`,
  );

  const { data: final } = await supabase
    .from("tennis_players")
    .select("name, rp, rating, rd, wins, losses, matches")
    .eq("group_id", group.id)
    .order("rp", { ascending: false });

  const { rankFromRp, RP } = await import("../src/lib/engine/ranks");
  console.log("\nFinal ladder:");
  for (const p of final ?? []) {
    const ranked = p.matches >= RP.placementMatches;
    const label = ranked ? rankFromRp(p.rp).label : "in placements";
    console.log(
      `  ${String(p.name).padEnd(8)} ${label.padEnd(14)} ` +
        `${String(Math.round(p.rp)).padStart(4)} RP   ` +
        `${p.wins}-${p.losses}   mmr ${Math.round(p.rating)} ±${Math.round(p.rd)}`,
    );
  }
}

async function fetch1(id: string) {
  const { data, error } = await db().from("tennis_players").select("*").eq("id", id).single();
  if (error) throw new Error(`fetch player: ${error.message}`);
  return data;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
