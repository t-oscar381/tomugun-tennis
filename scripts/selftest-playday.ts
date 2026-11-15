/**
 * Play-day smoke test against the real database.
 *
 * Drives the same functions the server actions call (openPlayDay, recordMatch,
 * removeMatch…) in a throwaway group that is deleted at the end, so it never
 * touches the real league even when pointed at production.
 *
 *   npm run selftest:playday
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, getPlayer, getPlayDay, sessionsReady } from "../src/lib/db";
import { dateOf, jakartaDate } from "../src/lib/dates";
import { FORMATS } from "../src/lib/engine/tennis";
import { PLAYDAY_SQL } from "../src/lib/playday-sql";
import { matchesOn, openPlayDay, recordMatch, removeMatch, setPresent } from "../src/lib/playday";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  if (!(await sessionsReady())) {
    console.log("\ntennis_sessions does not exist yet. Run this in the Supabase SQL editor first:\n");
    console.log(PLAYDAY_SQL, "\n");
    process.exit(2);
  }

  const supabase = db();
  const { data: group, error: gErr } = await supabase
    .from("tennis_groups")
    .insert({ slug: `selftest-pd-${Date.now()}`, name: "Play day self test", join_code: "TESTCODE" })
    .select("id")
    .single();
  if (gErr || !group) throw new Error(`create group: ${gErr?.message}`);
  const groupId = group.id as string;

  try {
    const mk = async (name: string) => {
      const { data, error } = await supabase
        .from("tennis_players").insert({ group_id: groupId, name }).select("id").single();
      if (error) throw new Error(`player ${name}: ${error.message}`);
      return data.id as string;
    };
    const [p1, p2, p3, p4] = [await mk("P1"), await mk("P2"), await mk("P3"), await mk("P4")];
    const fmt = FORMATS.bestOf3MatchTB;
    const today = jakartaDate();

    // ── Opening a play day ──────────────────────────────────────────────
    const first = await openPlayDay(groupId, today, [p1, p2, p3], p3);
    check("open a play day", first.ok && first.created);
    if (!first.ok) return;
    let day = first.day;
    check("it holds the people who turned up", day.attendees.length === 3);

    const again = await openPlayDay(groupId, today, [p4], p3);
    check("starting the same date again joins it, not duplicates", again.ok && !again.created && again.day.id === day.id);
    check("…and adds the newcomer", again.ok && again.day.attendees.length === 4);

    const removed = await setPresent(day, p4, false);
    check("untick someone", removed?.attendees.length === 3);
    day = removed ?? day;

    // ── Logging, by a referee who isn't playing ─────────────────────────
    const r1 = await recordMatch({ groupId, day, a: p1, b: p2, scoreline: "6-4 6-3", format: fmt, loggedBy: p3 });
    check("referee logs a match", r1.ok, r1.ok ? r1.text : r1.error);
    check("a straight-sets win is recorded", (await getPlayer(p1))?.wins === 1 && (await getPlayer(p2))?.losses === 1);

    const r2 = await recordMatch({ groupId, day, a: p2, b: p1, scoreline: "4-6 6-3 [10-8]", format: fmt, loggedBy: p3 });
    check("score is read from Player 1's side", r2.ok && (await getPlayer(p2))?.wins === 1);

    const r3 = await recordMatch({ groupId, day, a: p4, b: p1, scoreline: "6-2 6-2", format: fmt, loggedBy: p3 });
    check("logging for someone not ticked adds them", r3.ok && !!(await getPlayDay(day.id))?.attendees.includes(p4));

    const bad = await recordMatch({ groupId, day, a: p1, b: p2, scoreline: "6-5 6-3", format: fmt, loggedBy: p3 });
    check("rejects an impossible score", !bad.ok, bad.ok ? "" : bad.error);
    const self = await recordMatch({ groupId, day, a: p1, b: p1, scoreline: "6-4 6-3", format: fmt, loggedBy: p3 });
    check("rejects a player against themselves", !self.ok);

    // ── Filing and totals ───────────────────────────────────────────────
    const tonight = await matchesOn(groupId, today);
    check("matches are filed under the play day's date", tonight.length === 3 && tonight.every((m) => dateOf(m.played_at) === today));
    check("each records who logged it", tonight.every((m) => m.logged_by === p3));

    const yesterday = jakartaDate(new Date(Date.now() - 24 * 3600 * 1000));
    check("another date holds none of tonight's", (await matchesOn(groupId, yesterday)).length === 0);

    // ── Taking one back ─────────────────────────────────────────────────
    if (r1.ok) {
      const gone = await removeMatch(groupId, r1.matchId);
      check("remove a match", gone.ok);
      const a = await getPlayer(p1);
      // P1 had beaten P2, then lost to P2 and to P4. Remove the win: 0–2.
      check("totals follow the ledger", a?.wins === 0 && a?.losses === 2, `P1 ${a?.wins}-${a?.losses}`);
      const b = await getPlayer(p2);
      check("…for the other player too", b?.wins === 1 && b?.losses === 0, `P2 ${b?.wins}-${b?.losses}`);
    }
    const stranger = await removeMatch(groupId, "00000000-0000-0000-0000-000000000000");
    check("removing a match that isn't there fails cleanly", !stranger.ok);
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
