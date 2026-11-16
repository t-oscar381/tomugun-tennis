import Link from "next/link";
import { getGroupBySlug, getPlayers } from "@/lib/db";
import { jakartaDate, relativeDay } from "@/lib/dates";
import { losers, pointsTable, teamName, winRate, winners, type Row } from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { EXAMPLE_SLUG, GROUP_SLUG, inviteUrl } from "@/lib/league";
import { hasChosenFace } from "@/lib/pets";
import { SHOTS } from "@/lib/photos";
import { getSession } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { ClosingCta, Features, Gallery, Steps } from "@/components/how-it-works";
import { InviteCard } from "@/components/invite-card";
import { PetPicker } from "@/components/pet-picker";
import { Photo } from "@/components/photo";
import { Qr } from "@/components/qr";
import { Podium, PointsTable } from "@/components/points-table";
import { RenameForm } from "@/components/rename-form";

// Every view here changes the moment a game is logged, so nothing is
// prerendered. (No runtime = "edge" — it breaks page loading under OpenNext.)
export const dynamic = "force-dynamic";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
};

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <Welcome />;

  const { group, player } = session;
  const [players, games] = await Promise.all([getPlayers(group.id), getGames(group.id)]);

  const people = players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const petFor = (id: string) => players.find((p) => p.id === id)?.emoji;

  const table = pointsTable(games, players.map((p) => p.id));
  const mine = table.find((r) => r.id === player.id);
  const place = table.findIndex((r) => r.id === player.id) + 1;
  const today = jakartaDate();
  const todays = games.filter((g) => g.date === today);
  const todayRows = pointsTable(todays);
  // The roster started as single letters; nudge whoever claimed one to put their real name on it.
  const placeholder = player.name.length === 1;

  return (
    <div className="space-y-8">
      {placeholder && (
        <section className="card space-y-2 !border-clay/50 p-5">
          <h2 className="text-lg">You&apos;re signed in as &ldquo;{player.name}&rdquo;</h2>
          <p className="text-sm text-muted">
            That&apos;s a placeholder. Put your name on it so the others know who scored.
          </p>
          <RenameForm current={player.name} />
        </section>
      )}

      {/* First thing after signing in: choose your face. Gone once you have one. */}
      {!hasChosenFace(player.emoji) && (
        <section className="card rise !border-clay/50 p-5 sm:p-6">
          <PetPicker
            playerId={player.id}
            name={player.name}
            current={null}
            back="/"
            title={`Welcome, ${player.name}. Pick your pet.`}
          />
        </section>
      )}

      {/* ── You, on a court. */}
      <section className="rise relative isolate overflow-hidden rounded-3xl bg-court-deep text-white shadow-[0_24px_48px_-28px_rgb(6_42_32/0.7)]">
        <Photo shot={SHOTS.lines} w={1100} eager className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-court-deep/95 via-court-deep/80 to-court-deep/30" />
        <div className="flex flex-wrap items-end justify-between gap-6 p-6 sm:p-9">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar id={player.id} name={player.name} pet={player.emoji} size={72} ring="var(--color-lime)" />
            <div className="min-w-0">
              <p className="eyebrow text-lime">{group.name}</p>
              <h1 className="mt-1 truncate text-3xl leading-tight sm:text-5xl">{player.name}</h1>
            </div>
          </div>

          <dl className="nums flex items-end gap-6 sm:gap-9">
            <BigStat label={mine?.points === 1 ? "point" : "points"} value={mine?.points ?? 0} lead />
            <BigStat label="played" value={mine?.played ?? 0} />
            <BigStat label="wins" value={mine ? winRate(mine) : "—"} />
            {games.length > 0 && <BigStat label={`of ${table.length}`} value={ordinal(place)} />}
          </dl>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-6 py-4 sm:px-9">
          <p className="nums text-sm text-white/80">
            {todays.length === 0
              ? "Nothing logged today yet."
              : `${todays.length} ${todays.length === 1 ? "game" : "games"} logged today.`}
          </p>
          <Link href="/play" className="btn btn-clay !py-2.5 text-sm">
            Log a game <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_21rem] lg:items-start">
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-clay">The scoreboard</p>
              <h2 className="mt-1 text-3xl">Points</h2>
            </div>
            <span className="nums text-sm text-muted">
              {games.length} {games.length === 1 ? "game" : "games"} so far
            </span>
          </div>

          <Podium rows={table} people={people} />
          <PointsTable rows={table} people={people} meId={player.id} />

          {games.length === 0 && (
            <div className="card zoom grid overflow-hidden sm:grid-cols-[14rem_1fr]">
              <Photo shot={SHOTS.ready} w={460} className="h-40 w-full object-cover sm:h-full" />
              <div className="p-6">
                <h3 className="text-xl">The board is empty. Somebody has to go first.</h3>
                <p className="mt-1.5 text-sm text-muted">
                  After the next game, tap the four names and the team that won. It takes about five
                  seconds.
                </p>
                <Link href="/play" className="mt-4 inline-block font-bold text-clay underline">
                  Log the first game
                </Link>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          {todayRows.length > 0 && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-3">
                <h2 className="eyebrow text-muted">Today</h2>
                <Link href="/play" className="text-xs font-semibold text-clay">
                  Open the day
                </Link>
              </div>
              <ul className="divide-y divide-line">
                {todayRows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Avatar id={r.id} name={nameOf(r.id)} pet={petFor(r.id)} size={30} />
                    <span className="flex-1 truncate font-semibold">{nameOf(r.id)}</span>
                    <span className="display nums text-xl">{r.points}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="eyebrow text-muted">Latest games</h2>
            {games.length === 0 ? (
              <p className="text-sm text-muted">No games yet.</p>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {games.slice(0, 7).map((g) => (
                  <li key={g.id} className="px-4 py-3 text-sm">
                    <span className="font-semibold">{teamName(winners(g), nameOf)}</span>
                    <span className="text-muted"> beat </span>
                    {teamName(losers(g), nameOf)}
                    <span className="mt-0.5 block text-xs text-muted">{relativeDay(g.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <InviteCard inviteUrl={inviteUrl(group.join_code)} code={group.join_code} qr={<Qr value={inviteUrl(group.join_code)} />} />
        </aside>
      </div>
    </div>
  );
}

function BigStat({ label, value, lead }: { label: string; value: number | string; lead?: boolean }) {
  return (
    <div>
      <dd className={`display leading-none ${lead ? "text-6xl text-lime sm:text-7xl" : "text-2xl sm:text-3xl"}`}>
        {value}
      </dd>
      <dt className="eyebrow mt-1.5 text-white/65">{label}</dt>
    </div>
  );
}

/** The signed-out home page: what this is, how to use it, then the door. */
async function Welcome() {
  const group = await getGroupBySlug(GROUP_SLUG);
  const sample = await sampleBoard();

  return (
    <div className="space-y-20 sm:space-y-28">
      {/* ── Hero: edge to edge, straight under the header. */}
      <section className="bleed relative isolate -mt-6 overflow-hidden bg-court-deep text-white">
        <Photo
          shot={SHOTS.serve}
          w={1600}
          eager
          sizes="100vw"
          className="absolute inset-0 -z-20 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-court-deep via-court-deep/55 to-court-deep/10 sm:bg-gradient-to-r sm:from-court-deep/95 sm:via-court-deep/60 sm:to-transparent" />

        <div className="mx-auto flex min-h-[78svh] max-w-6xl flex-col justify-end px-4 pb-10 pt-32 sm:min-h-[640px] sm:justify-center sm:px-6 sm:py-24">
          <p className="rise eyebrow text-lime">{group?.name ?? "Friendly tennis · Jakarta"}</p>
          <h1 className="rise mt-4 max-w-2xl text-5xl leading-[0.98] sm:text-7xl" style={{ ["--d" as string]: "80ms" }}>
            Play the game.
            <br />
            <em className="text-lime">Tap who won.</em>
          </h1>
          <p className="rise mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg" style={{ ["--d" as string]: "160ms" }}>
            The scoreboard for friends who share a court. No scores to type, no rules to learn —
            the winners get a point, and everyone can see the table.
          </p>
          <div className="rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "240ms" }}>
            <Link href="/join" className="btn btn-clay">
              {group ? `Join ${group.name}` : "Join the group"} <span aria-hidden>→</span>
            </Link>
            <Link href="/example" className="btn btn-ghost">
              See an example season
            </Link>
          </div>
          <p className="rise mt-4 text-xs text-white/60" style={{ ["--d" as string]: "300ms" }}>
            You&apos;ll need the link or code from whoever invited you.
          </p>
        </div>

        {/* Three facts along the bottom edge of the photo. */}
        <dl className="border-t border-white/15 bg-court-deep/60 backdrop-blur-sm">
          <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-white/15 px-4 sm:px-6">
            {[
              ["1", "tap to log a game"],
              ["0", "scores to type"],
              ["+1", "point for every winner"],
            ].map(([n, l]) => (
              <div key={l} className="px-3 py-5 first:pl-0 sm:px-8 sm:py-6">
                <dd className="display nums text-3xl text-lime sm:text-4xl">{n}</dd>
                <dt className="mt-1 text-xs leading-snug text-white/75 sm:text-sm">{l}</dt>
              </div>
            ))}
          </div>
        </dl>
      </section>

      {/* ── How it works. */}
      <section className="space-y-8">
        <div className="max-w-xl">
          <p className="eyebrow text-clay">How it works</p>
          <h2 className="mt-3 text-3xl leading-tight sm:text-5xl">
            Three steps, and one of them is <em className="text-clay">tennis.</em>
          </h2>
        </div>
        <Steps />
      </section>

      {/* ── What the board looks like. */}
      {sample && (
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_26rem] lg:gap-16">
          <div>
            <p className="eyebrow text-clay">The scoreboard</p>
            <h2 className="mt-3 text-3xl leading-tight sm:text-5xl">
              One table the <em className="text-clay">whole group</em> can see.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">
              Tommy &amp; Val beat Rene &amp; Stephanie: Tommy and Val get a point each. Partners
              change every game, the points follow the person. By the end of the night the table
              has settled it.
            </p>
            <Link href="/example" className="mt-5 inline-block font-bold text-clay underline underline-offset-4">
              Look through the example season
            </Link>
          </div>

          <div className="relative isolate">
            <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-court sm:-inset-6" />
            <div className="card overflow-hidden !shadow-2xl">
              <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-4 py-3">
                <span className="eyebrow text-muted">Sample season</span>
                <span className="nums text-xs text-muted">{sample.games} games</span>
              </div>
              <ol className="divide-y divide-line">
                {sample.rows.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="nums w-5 text-center text-sm font-bold text-muted">{i + 1}</span>
                    <Avatar id={r.id} name={sample.nameOf(r.id)} pet={sample.petFor(r.id)} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{sample.nameOf(r.id)}</span>
                      <span className="nums block text-xs text-muted">
                        {r.played} played · {winRate(r)} wins
                      </span>
                    </span>
                    <span className="display nums text-2xl">{r.points}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      <Features />
      <Gallery />

      <ClosingCta
        title={
          <>
            Next game&apos;s on. <em className="text-lime">Bring the group.</em>
          </>
        }
        body="It's free, there is nothing to install, and it works on whatever phone is nearest the bench."
        href="/join"
        label={group ? `Join ${group.name}` : "Join the group"}
      />
    </div>
  );
}

/** The top of the example group's table, to show a real board on the front page. */
async function sampleBoard(): Promise<{
  rows: Row[];
  games: number;
  nameOf: (id: string) => string;
  petFor: (id: string) => string | undefined;
} | null> {
  try {
    const group = await getGroupBySlug(EXAMPLE_SLUG);
    if (!group) return null;
    const [players, games] = await Promise.all([getPlayers(group.id), getGames(group.id)]);
    if (games.length === 0) return null;
    return {
      rows: pointsTable(games).slice(0, 5),
      games: games.length,
      nameOf: (id) => players.find((p) => p.id === id)?.name ?? "?",
      petFor: (id) => players.find((p) => p.id === id)?.emoji,
    };
  } catch {
    // The front page must never fail because the sample data is missing.
    return null;
  }
}
