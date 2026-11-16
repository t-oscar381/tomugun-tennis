"use server";

import { revalidatePath } from "next/cache";
import { safeNext } from "@/lib/next";
import { redirect } from "next/navigation";
import { db, getGroupBySlug, getPlayer, getPlayers, getTournament } from "@/lib/db";
import { isIsoDate, jakartaDate } from "@/lib/dates";
import { buildBracket, champion, setWinner, type Entrant } from "@/lib/engine/bracket";
import { GROUP_SLUG } from "@/lib/league";
import { cleanName, nameError, nameTaken } from "@/lib/names";
import { recordGame, removeGame } from "@/lib/gamesdb";
import { clearSession, codeMatches, getSession, setSessionPlayer } from "@/lib/session";

type State = { error?: string };

/** For forms that confirm what they did: a message, and a stamp so the client can tell a new one from an old one. */
type DoneState = { error?: string; ok?: string; stamp?: number };

/** Join the league: check the code, then claim (or create) a player. */
export async function joinAction(_prev: State, form: FormData): Promise<State> {
  const code = String(form.get("code") ?? "");
  const playerId = String(form.get("playerId") ?? "");
  const newName = cleanName(String(form.get("newName") ?? ""));
  // Someone who opened a link to a page they had to sign in for goes back to it.
  const next = safeNext(form.get("next"));

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return { error: "League not found. Has supabase/schema.sql been run?" };
  if (!codeMatches(code, group.join_code)) return { error: "That join code isn't right." };

  if (playerId) {
    const player = await getPlayer(playerId);
    if (!player || player.group_id !== group.id) return { error: "Unknown player." };
    await setSessionPlayer(player.id);
    redirect(next);
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
  redirect(next);
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


// ── Games ──────────────────────────────────────────────────────────────────

/** Add a person to the group without signing in as them. Eight people share one pool; the eighth turns up eventually. */
export async function addPlayerAction(_prev: DoneState, form: FormData): Promise<DoneState> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const name = cleanName(String(form.get("name") ?? ""));
  const bad = nameError(name);
  if (bad) return { error: bad };
  if (nameTaken(await getPlayers(session.group.id), name)) {
    return { error: `There's already a ${name}.` };
  }

  const { error } = await db().from("tennis_players").insert({ group_id: session.group.id, name });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: `Added ${name}.`, stamp: Date.now() };
}

/**
 * Log who won a game. Anyone in the group can — there is one court and six
 * people watching it — so identity matters only for "logged by".
 */
export async function logGameAction(_prev: DoneState, form: FormData): Promise<DoneState> {
  const session = await getSession();
  if (!session) return { error: "Sign in first." };

  const date = String(form.get("date") ?? "") || jakartaDate();
  if (!isIsoDate(date)) return { error: "That isn't a real date." };
  // Back-dating is the point (log last night's games this morning); next week is a typo.
  if (date > jakartaDate(new Date(Date.now() + 24 * 3600 * 1000))) {
    return { error: "That date hasn't happened yet." };
  }

  const ids = (key: string) => String(form.get(key) ?? "").split(",").filter(Boolean);
  const win = String(form.get("win") ?? "");

  const result = await recordGame({
    groupId: session.group.id,
    date,
    a: ids("a"),
    b: ids("b"),
    win: win === "a" ? "a" : win === "b" ? "b" : ("" as "a"),
    loggedBy: session.player.id,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  return { ok: result.text, stamp: Date.now() };
}

/** Take a game back out. Anyone can: the room is the safeguard, and it takes two taps. */
export async function removeGameAction(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await removeGame(session.group.id, String(form.get("gameId") ?? ""));
  revalidatePath("/", "layout");
}
