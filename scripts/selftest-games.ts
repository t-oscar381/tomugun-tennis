/**
 * Games smoke test against the real database.
 *
 * Re-enacts the group's own example — Tommy & Val beat Rene & Stephanie, then
 * Tommy & Rene beat Val & Koi — through the same functions the server actions
 * call, in a throwaway group that is deleted at the end. It never touches the
 * real league, even when pointed at production.
 *
 *   npm run selftest:games
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { jakartaDate, shiftDate } from "../src/lib/dates";
import { pointsTable } from "../src/lib/games";
import { getGames, recordGame, removeGame } from "../src/lib/gamesdb";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const supabase = db();
  const { data: group, error: gErr } = await supabase
    .from("tennis_groups")
    .insert({ slug: `selftest-games-${Date.now()}`, name: "Games self test", join_code: "TESTCODE" })
    .select("id")
    .single();
  if (gErr || !group) throw new Error(`create group: ${gErr?.message}`);
  const groupId = group.id as string;

  try {
    const ids: Record<string, string> = {};
    for (const name of ["Tommy", "Val", "Rene", "Stephanie", "Koi"]) {
      const { data, error } = await supabase
        .from("tennis_players").insert({ group_id: groupId, name }).select("id").single();
      if (error) throw new Error(`player ${name}: ${error.message}`);
      ids[name] = data.id as string;
    }
    const { Tommy: T, Val: V, Rene: R, Stephanie: S, Koi: K } = ids as Record<string, string>;
    const today = jakartaDate();
    const pts = async () => Object.fromEntries(
      pointsTable(await getGames(groupId), Object.values(ids)).map((r) => [r.id, r]),
    );

    // ── The group's example ─────────────────────────────────────────────
    const g1 = await recordGame({ groupId, date: today, a: [T!, V!], b: [R!, S!], win: "a", loggedBy: K! });
    check("log a doubles game (someone sitting out logs it)", g1.ok, g1.ok ? g1.text : g1.error);

    const g2 = await recordGame({ groupId, date: today, a: [V!, K!], b: [T!, R!], win: "b", loggedBy: S! });
    check("log the second game", g2.ok, g2.ok ? g2.text : g2.error);

    const p = await pts();
    check("Tommy has 2 points", p[T!]?.points === 2, `Tommy ${p[T!]?.points}`);
    check("Val and Rene have 1 each", p[V!]?.points === 1 && p[R!]?.points === 1);
    check("Stephanie and Koi have 0", p[S!]?.points === 0 && p[K!]?.points === 0);
    check("losers still count the game as played", p[S!]?.played === 1 && p[K!]?.played === 1);

    // ── Rules ───────────────────────────────────────────────────────────
    const dup = await recordGame({ groupId, date: today, a: [V!, K!], b: [T!, R!], win: "b", loggedBy: T! });
    check("the same result logged twice counts once", !dup.ok, dup.ok ? "" : dup.error);

    const rematch = await recordGame({ groupId, date: today, a: [V!, K!], b: [T!, R!], win: "a", loggedBy: T! });
    check("the same teams with a different winner is a real game", rematch.ok);
    if (rematch.ok) await removeGame(groupId, rematch.id);

    const solo = await recordGame({ groupId, date: today, a: [T!], b: [R!], win: "a", loggedBy: T! });
    check("one against one works too", solo.ok);
    if (solo.ok) await removeGame(groupId, solo.id);

    check("rejects someone on both teams", !(await recordGame({ groupId, date: today, a: [T!, V!], b: [V!, R!], win: "a", loggedBy: T! })).ok);
    check("rejects a team of three", !(await recordGame({ groupId, date: today, a: [T!, V!, R!], b: [S!], win: "a", loggedBy: T! })).ok);
    check("rejects an empty team", !(await recordGame({ groupId, date: today, a: [], b: [S!], win: "a", loggedBy: T! })).ok);
    check("rejects someone from outside the league", !(await recordGame({ groupId, date: today, a: [T!], b: ["00000000-0000-0000-0000-000000000000"], win: "a", loggedBy: T! })).ok);

    // ── Days ────────────────────────────────────────────────────────────
    const yesterday = shiftDate(today, -1);
    const back = await recordGame({ groupId, date: yesterday, a: [T!], b: [K!], win: "a", loggedBy: T! });
    check("log a game for yesterday", back.ok);
    check("today holds today's two games", (await getGames(groupId, { date: today })).length === 2);
    check("yesterday holds only its own", (await getGames(groupId, { date: yesterday })).length === 1);

    // ── Undo ────────────────────────────────────────────────────────────
    if (g1.ok) {
      const gone = await removeGame(groupId, g1.id);
      check("remove a game", gone.ok);
      const after = await pts();
      check("points follow: Tommy 2→1 (+1 from yesterday = 2)", after[T!]?.points === 2, `Tommy ${after[T!]?.points}`);
      check("…and Val loses the point from it", after[V!]?.points === 0, `Val ${after[V!]?.points}`);
    }
    check("removing a game that isn't there fails cleanly", !(await removeGame(groupId, "00000000-0000-0000-0000-000000000000")).ok);

    // Old tennis rows must be ignored, and never deletable as games.
    const { data: legacy } = await supabase.from("tennis_matches").insert({
      group_id: groupId, player_a: T, player_b: R, winner_id: T,
      sets: [{ a: 6, b: 4 }], scoreline: "6-4", games_a: 6, games_b: 4, win_prob_a: 0.5,
      status: "confirmed", logged_by: T, rating_period: today, played_at: new Date().toISOString(),
    }).select("id").single();
    check("an old tennis match is not counted as a game", (await getGames(groupId)).every((g) => g.id !== legacy?.id));
    check("…and cannot be removed as one", legacy ? !(await removeGame(groupId, legacy.id as string)).ok : false);
  } finally {
    const { error } = await supabase.from("tennis_groups").delete().eq("id", groupId);
    check("cleaned up the throwaway group", !error, error?.message ?? "");
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nSelf-test threw:", e instanceof Error ? e.message : e);
  process.exit(1);
});
