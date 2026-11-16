/**
 * Sample doubles games for the read-only /example league.
 *
 * Six weekly play days, six of eight made-up players each, two-against-two, the
 * stronger pair winning more often than not. Existing tennis matches in that
 * league are left alone — they are no longer shown, not deleted.
 *
 *   npm run seed:games            add them, if the example has none yet
 *   npm run seed:games -- --reset  replace the example's games
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, getGroupBySlug, getPlayers, ratingPeriodOf } from "../src/lib/db";
import { jakartaDate, playedAtFor, shiftDate } from "../src/lib/dates";
import { encodeGame } from "../src/lib/games";
import { getGames } from "../src/lib/gamesdb";
import { EXAMPLE_SLUG } from "../src/lib/league";

const STRENGTH: Record<string, number> = {
  Andre: 8, Bimo: 7, Cakra: 7, Dimas: 6, Eka: 5, Fajar: 5, Gilang: 4, Hendra: 3,
};

// Small seeded generator so the sample is the same every time it is rebuilt.
let seed = 20261116;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

async function main() {
  const group = await getGroupBySlug(EXAMPLE_SLUG);
  if (!group) throw new Error(`No "${EXAMPLE_SLUG}" group. Run supabase/schema.sql first.`);

  const existing = await getGames(group.id);
  if (existing.length && !process.argv.includes("--reset")) {
    console.log(`The example league already has ${existing.length} games. Use --reset to replace them.`);
    return;
  }
  if (existing.length) {
    await db().from("tennis_matches").delete().in("id", existing.map((g) => g.id));
    console.log(`Removed ${existing.length} old sample games.`);
  }

  const players = (await getPlayers(group.id)).filter((p) => p.name in STRENGTH);
  if (players.length < 6) throw new Error("The example league needs its eight sample players.");
  const power = (id: string) => STRENGTH[players.find((p) => p.id === id)!.name]!;

  const today = jakartaDate();
  const days = [-40, -33, -26, -19, -12, -5].map((d) => shiftDate(today, d));

  let total = 0;
  for (const date of days) {
    const here = shuffle(players).slice(0, 6).map((p) => p.id);
    const games = 8 + Math.floor(rand() * 3);

    for (let i = 0; i < games; i++) {
      const four = shuffle(here).slice(0, 4);
      const a = four.slice(0, 2);
      const b = four.slice(2);
      const edge = a.reduce((n, id) => n + power(id), 0) - b.reduce((n, id) => n + power(id), 0);
      const win = rand() < 1 / (1 + Math.exp(-edge / 4)) ? "a" : "b";

      // Spread the day's games over the evening so they sort the way they were "played".
      const at = new Date(`${date}T10:00:00Z`);
      at.setUTCMinutes(i * 9);

      const { error } = await db().from("tennis_matches").insert({
        group_id: group.id,
        player_a: a[0],
        player_b: b[0],
        winner_id: win === "a" ? a[0] : b[0],
        sets: encodeGame(a, b, win),
        scoreline: "1-0",
        games_a: win === "a" ? 1 : 0,
        games_b: win === "b" ? 1 : 0,
        win_prob_a: 0.5,
        status: "confirmed",
        logged_by: here[0],
        confirmed_at: at.toISOString(),
        rated_at: at.toISOString(),
        rp_delta_a: 0,
        rp_delta_b: 0,
        placement: false,
        rating_period: ratingPeriodOf(new Date(playedAtFor(date))),
        played_at: playedAtFor(date),
        created_at: at.toISOString(),
      });
      if (error) throw new Error(`insert: ${error.message}`);
      total++;
    }
  }
  console.log(`Added ${total} sample games over ${days.length} play days.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
