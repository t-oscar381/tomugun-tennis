"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  db,
  getGroupBySlug,
  getPlayer,
  getPlayers,
  getTournament,
  ratingPeriodOf,
} from "@/lib/db";
import { isIsoDate, jakartaDate } from "@/lib/dates";
import { buildBracket, champion, setWinner, type Entrant } from "@/lib/engine/bracket";
import { parseScoreline } from "@/lib/engine/scoreline";
import { GROUP_SLUG, formatFor } from "@/lib/league";
import { cleanName, nameError, nameTaken } from "@/lib/names";
import { getPlayDay } from "@/lib/db";
import { matchesOn, openPlayDay, recordMatch, removeMatch, setPresent } from "@/lib/playday";
import { confirmMatch, runRatingPeriods, winChance } from "@/lib/rating";
import { clearSession, codeMatches, getSession, setSessionPlayer } from "@/lib/session";

type State = { error?: string };

/** For the play-day forms: a confirmation to show, and a stamp so the client can tell a new one. */
type PlayState = { error?: string; ok?: string; stamp?: number };

/** Join the league: check the code, then claim (or create) a player. */
export async function joinAction(_prev: State, form: FormData): Promise<State> {
  const code = String(form.get("code") ?? "");
  const playerId = String(form.get("playerId") ?? "");
  const newName = cleanName(String(form.get("newName") ?? ""));

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return { error: "League not found. Has supabase/schema.sql been run?" };
  if (!codeMatches(code, group.join_code)) return { error: "That join code isn't right." };

  if (playerId) {
    const player = await getPlayer(playerId);
    if (!player || player.group_id !== group.id) return { error: "Unknown player." };
    await setSessionPlayer(player.id);
    redirect("/");
  }

  const bad = nameError(newName);
  if (bad) return { error: bad === "Type a name." ? "Type your name, or tap your slot." : bad };
  if (nameTaken(await getPlayers(group.id), newName)) {
    return { error: "Someone already has that name — if that's you, tap your slot instead." };
  }

  const { data, error } = await db()
    .from("tennis_players")
    .insert({ group_id: group.id, name: newName })
    .select("id")
    .single();

  // 23505 = unique_violation on (group_id, name).
  if (error?.code === "23505") return { error: "Someone already has that name." };
  if (error) return { error: error.message };

  await setSessionPlayer(data.id as string);
  redirect("/");
}

/**
 * Sign out. Lands on "/" rather than "/join" so the person sees what the app
 * is before being asked for a code again — which matters when someone signs
 * out on a shared phone and hands it to a friend.
 */
export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

/**
 * Log a finished match. The result is stored `pending` and moves nothing until
 * the opponent confirms — an unverified ledger is worse than no ladder at all.
 */
export async function logMatchAction(_prev: State, form: FormData): Promise<State> {
  const oppId = String(form.get("opponentId") ?? "");
  const raw = String(form.get("score") ?? "");

  // Who is logging comes from the session cookie. It used to be a hidden form
  // field, which let anyone log a result as anyone else.
  const session = await getSession();
  if (!session) return { error: "Sign in first." };
  const { group, player: me } = session;

  if (!oppId) return { error: "Pick an opponent." };
  if (me.id === oppId) return { error: "You can't play yourself." };

  const opponent = await getPlayer(oppId);
  if (!opponent || opponent.group_id !== group.id) {
    return { error: "That player isn't in this league." };
  }

  const format = formatFor(group);
  const parsed = parseScoreline(raw, format);
  if (!parsed.ok) return { error: parsed.error };

  // The winner comes from the score itself. The form used to ask separately
  // and then reject the answer when the two disagreed; there is only one
  // question worth asking, so there is now only one answer to be wrong.
  const iWon = parsed.value.winner === "A";

  const winProbA = winChance(me, opponent);

  const { error } = await db()
    .from("tennis_matches")
    .insert({
      group_id: group.id,
      player_a: me.id,
      player_b: opponent.id,
      winner_id: iWon ? me.id : opponent.id,
      sets: parsed.value.sets,
      scoreline: raw.trim(),
      games_a: parsed.value.gamesA,
      games_b: parsed.value.gamesB,
      win_prob_a: winProbA,
      logged_by: me.id,
      rating_period: ratingPeriodOf(new Date()),
    });

  if (error) return { error: error.message };

  revalidatePath("/");
  redirect("/?logged=1");
}

/** A match the signed-in player took part in, or null. */
async function myMatch(matchId: string) {
  const session = await getSession();
  if (!session || !matchId) return null;
  const { data } = await db()
    .from("tennis_matches")
    .select("id, player_a, player_b, logged_by, status, group_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!data || data.group_id !== session.group.id) return null;
  const me = session.player.id;
  if (data.player_a !== me && data.player_b !== me) return null;
  return { match: data, me };
}

/**
 * The opponent agrees the result is right. Only the player who did NOT log it
 * may confirm — otherwise "your opponent has to agree" is a suggestion, not a
 * rule. (The 48-hour auto-confirm calls confirmMatch directly.)
 */
export async function confirmAction(form: FormData): Promise<void> {
  const found = await myMatch(String(form.get("matchId") ?? ""));
  if (!found || found.match.logged_by === found.me) return;

  await confirmMatch(found.match.id as string);
  revalidatePath("/");
}

export async function disputeAction(form: FormData): Promise<void> {
  const found = await myMatch(String(form.get("matchId") ?? ""));
  if (!found || found.match.status !== "pending") return;

  // Disputes are deliberately a dead end rather than an edit flow: the two
  // players sort it out and re-log.
  await db().from("tennis_matches").update({ status: "disputed" }).eq("id", found.match.id);
  revalidatePath("/");
}

/** Change your own display name. Placeholders like "A" are meant to be replaced. */
export async function renameAction(_prev: State, form: FormData): Promise<State> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const name = cleanName(String(form.get("name") ?? ""));
  const bad = nameError(name);
  if (bad) return { error: bad };
  if (nameTaken(await getPlayers(session.group.id), name, session.player.id)) {
    return { error: "Someone already has that name." };
  }

  const { error } = await db()
    .from("tennis_players")
    .update({ name })
    .eq("id", session.player.id);

  if (error?.code === "23505") return { error: "Someone already has that name." };
  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/player/${session.player.id}?renamed=1`);
}

/** Fold closed weeks into Glicko-2. Safe to call repeatedly; it's a no-op once caught up. */
export async function recalcAction(): Promise<void> {
  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return;
  await runRatingPeriods(group.id);
  revalidatePath("/");
}

export async function listPlayers() {
  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return [];
  return getPlayers(group.id);
}


// ── Tournaments ────────────────────────────────────────────────────────────

/**
 * Create a knockout draw.
 *
 * The client assembles the entrant list — it already knows who is ticked and
 * how pairs were made — but every member id is re-checked against the group
 * here. A client-supplied list of ids is exactly the sort of thing that must
 * not be taken on trust just because the UI produced it.
 */
export async function createTournamentAction(_prev: State, form: FormData): Promise<State> {
  const name = String(form.get("name") ?? "").trim() || "Tournament";
  const kind = form.get("kind") === "pair" ? "pair" : "solo";
  const seeded = form.get("seeded") !== "random";
  const raw = String(form.get("entrants") ?? "[]");

  const session = await getSession();
  if (!session) return { error: "Sign in first." };
  const group = session.group;

  let entrants: Entrant[];
  try {
    entrants = JSON.parse(raw) as Entrant[];
  } catch {
    return { error: "Could not read the field." };
  }

  if (!Array.isArray(entrants) || entrants.length < 2) {
    return { error: "You need at least two entrants." };
  }
  if (entrants.length > 32) return { error: "32 entrants is the maximum." };

  const roster = new Set((await getPlayers(group.id)).map((p) => p.id));
  for (const e of entrants) {
    if (!Array.isArray(e.members) || e.members.length !== (kind === "pair" ? 2 : 1)) {
      return { error: "Every side needs the right number of players." };
    }
    for (const m of e.members) {
      if (!roster.has(m)) return { error: "Someone in the draw isn't in this league." };
    }
  }

  const seen = new Set<string>();
  for (const e of entrants) {
    for (const m of e.members) {
      if (seen.has(m)) return { error: "Somebody is in the draw twice." };
      seen.add(m);
    }
  }

  const bracket = buildBracket(entrants, { seeded, seed: Date.now() % 100000 });
  if (!bracket) return { error: "That field can't make a bracket." };

  const { data, error } = await db()
    .from("tennis_tournaments")
    .insert({
      group_id: group.id,
      name: name.slice(0, 60),
      kind,
      seeded,
      bracket,
      created_by: session.player.id,
    })
    .select("id")
    .single();

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return { error: "Tournaments need a database update — run supabase/schema.sql." };
  }
  if (error) return { error: error.message };

  redirect(`/tournaments/${data.id as string}`);
}

/** Record who won a bracket match, and re-derive everything downstream. */
export async function advanceBracketAction(form: FormData): Promise<void> {
  if (!(await getSession())) return;
  const id = String(form.get("tournamentId") ?? "");
  const round = Number(form.get("round"));
  const index = Number(form.get("index"));
  const winnerId = String(form.get("winnerId") ?? "") || null;
  if (!id || Number.isNaN(round) || Number.isNaN(index)) return;

  const t = await getTournament(id);
  if (!t) return;

  const next = setWinner(t.bracket, round, index, winnerId);
  const king = champion(next);

  await db()
    .from("tennis_tournaments")
    .update({
      bracket: next,
      champion_name: king?.name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/tournaments/${id}`);
}

export async function deleteTournamentAction(form: FormData): Promise<void> {
  if (!(await getSession())) return;
  const id = String(form.get("tournamentId") ?? "");
  if (!id) return;
  await db().from("tennis_tournaments").delete().eq("id", id);
  redirect("/tournaments");
}


// ── Play days ──────────────────────────────────────────────────────────────

/** Add a person to the league without signing in as them — and, from a play day, mark them here. */
export async function addPlayerAction(_prev: PlayState, form: FormData): Promise<PlayState> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const name = cleanName(String(form.get("name") ?? ""));
  const bad = nameError(name);
  if (bad) return { error: bad };
  if (nameTaken(await getPlayers(session.group.id), name)) {
    return { error: `There's already a ${name}.` };
  }

  const { data, error } = await db()
    .from("tennis_players")
    .insert({ group_id: session.group.id, name })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const sessionId = String(form.get("sessionId") ?? "");
  if (sessionId) {
    const day = await getPlayDay(sessionId);
    if (day && day.group_id === session.group.id) await setPresent(day, data.id as string, true);
  }

  revalidatePath("/", "layout");
  return { ok: `Added ${name}.`, stamp: Date.now() };
}

/** Start today's play day (or any date), with the people who turned up. */
export async function startPlayDayAction(_prev: State, form: FormData): Promise<State> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const date = String(form.get("date") ?? "") || jakartaDate();
  if (!isIsoDate(date)) return { error: "That isn't a real date." };
  // Back-dating is the point (log last night's games this morning); next week is a typo.
  if (date > jakartaDate(new Date(Date.now() + 24 * 3600 * 1000))) {
    return { error: "That date hasn't happened yet." };
  }

  const picked = [...new Set(form.getAll("attendee").map(String))];
  if (picked.length < 2) return { error: "Tick at least two people who are here." };

  const roster = new Set((await getPlayers(session.group.id)).map((p) => p.id));
  if (!picked.every((id) => roster.has(id))) return { error: "Someone isn't in this league." };

  const result = await openPlayDay(session.group.id, date, picked, session.player.id);
  if (!result.ok) return { error: result.error };

  redirect(`/play/${result.day.id}`);
}

/** Tick someone as here, or not. */
export async function togglePresentAction(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const day = await getPlayDay(String(form.get("sessionId") ?? ""));
  if (!day || day.group_id !== session.group.id) return;

  const playerId = String(form.get("playerId") ?? "");
  const present = form.get("present") === "1";

  const roster = new Set((await getPlayers(session.group.id)).map((p) => p.id));
  if (!roster.has(playerId)) return;

  // Someone who has already played tonight is, self-evidently, here.
  if (!present) {
    const played = (await matchesOn(session.group.id, day.played_on)).some(
      (m) => m.player_a === playerId || m.player_b === playerId,
    );
    if (played) return;
  }

  await setPresent(day, playerId, present);
  revalidatePath("/", "layout");
}

/** Log a result under a play day. Whoever is resting can do this for the others. */
export async function logPlayDayMatchAction(_prev: PlayState, form: FormData): Promise<PlayState> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const day = await getPlayDay(String(form.get("sessionId") ?? ""));
  if (!day || day.group_id !== session.group.id) return { error: "That play day isn't here." };

  const result = await recordMatch({
    groupId: session.group.id,
    day,
    a: String(form.get("a") ?? ""),
    b: String(form.get("b") ?? ""),
    scoreline: String(form.get("score") ?? ""),
    format: formatFor(session.group),
    loggedBy: session.player.id,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: result.text, stamp: Date.now() };
}

/** Take a result back out — anyone in the group can, because the room is the safeguard. */
export async function removePlayDayMatchAction(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await removeMatch(session.group.id, String(form.get("matchId") ?? ""));
  revalidatePath("/", "layout");
}
