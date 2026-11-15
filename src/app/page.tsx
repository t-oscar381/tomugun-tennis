import Link from "next/link";
import { getDisputedFor, getGroupBySlug, getMatches, getPendingFor, getPlayers } from "@/lib/db";
import { GROUP_SLUG } from "@/lib/league";
import { CONFIRM_WINDOW_HOURS, autoConfirmStale, hoursLeftToConfirm, runRatingPeriods } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { InviteCard } from "@/components/invite-card";
import { RenameForm } from "@/components/rename-form";
import { ResultsList, Standings, flipSetToken } from "@/components/standings";
import { FlowDiagram, Hero, JoinCta, PhotoStrip, Steps } from "@/components/how-it-works";
import { confirmAction, disputeAction } from "./actions";

// Every view here changes the moment a match is confirmed, so nothing is
// prerendered. (No runtime = "edge" — it breaks page loading under OpenNext.)
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const session = await getSession();
  if (!session) return <Welcome />;

  const { group, player } = session;
  const { logged } = await searchParams;

  // Silence counts as agreement once the dispute window lapses. Ratings are
  // still folded in underneath even though ranks are hidden, so turning them
  // on later needs no backfill. Called directly, not via a server action:
  // revalidatePath during render throws.
  await autoConfirmStale(group.id);
  await runRatingPeriods(group.id);

  const [players, pending, disputed, recent] = await Promise.all([
    getPlayers(group.id),
    getPendingFor(group.id, player.id),
    getDisputedFor(group.id, player.id),
    getMatches(group.id, { limit: 12, status: "confirmed" }),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));
  // The roster starts as single letters; nudge whoever claimed one to put
  // their real name on it.
  const placeholder = player.name.length === 1;

  return (
    <div className="space-y-6">
      {logged && (
        <p className="rounded-xl border border-[var(--color-clay)]/40 bg-[var(--color-clay-soft)] px-4 py-3 text-sm">
          <strong className="font-semibold">Logged.</strong> Your opponent has to confirm it before
          it counts — nudge them if they&apos;re slow.
        </p>
      )}

      {placeholder && (
        <section className="space-y-2 rounded-2xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-5">
          <h2 className="font-bold">You&apos;re signed in as &ldquo;{player.name}&rdquo;</h2>
          <p className="text-sm text-[var(--color-muted)]">
            That&apos;s a placeholder. Put your name on it so the others know who they played.
          </p>
          <RenameForm current={player.name} />
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-2xl"
          >
            {player.emoji}
          </span>
          <div>
            <p className="text-xs text-[var(--color-muted)]">{group.name}</p>
            <h1 className="text-xl font-bold tracking-tight">{player.name}</h1>
          </div>
        </div>
        <p className="nums text-right">
          <span className="text-2xl font-bold">
            {player.wins}–{player.losses}
          </span>
          <span className="block text-xs text-[var(--color-muted)]">won – lost</span>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Records</h2>
            <span className="text-sm text-[var(--color-muted)]">{players.length} players</span>
          </div>
          <Standings players={players} meId={player.id} />
        </section>

        <aside className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="font-bold">Waiting on you</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Check the score is right. Anything you don&apos;t answer counts on its own after{" "}
                  {CONFIRM_WINDOW_HOURS} hours.
                </p>
              </div>
              {pending.map((m) => {
                const opponentId = m.player_a === player.id ? m.player_b : m.player_a;
                const iWon = m.winner_id === player.id;
                const asWritten =
                  m.player_a === player.id
                    ? m.scoreline
                    : m.scoreline.split(" ").map(flipSetToken).join(" ");
                const left = hoursLeftToConfirm(m.created_at);

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-4"
                  >
                    <p className="text-sm">
                      <span className="font-semibold">{byId.get(opponentId)?.name ?? "Someone"}</span>{" "}
                      says{" "}
                      <span
                        className={`font-semibold ${
                          iWon ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"
                        }`}
                      >
                        {iWon ? "you won" : "you lost"}
                      </span>
                    </p>
                    <p className="nums mt-1 text-lg font-bold">{asWritten}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {left > 0
                        ? `Counts automatically in ${left}h if you don't say otherwise.`
                        : "About to count automatically."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={confirmAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <button className="rounded-lg bg-[var(--color-clay)] px-4 py-2 text-sm font-bold text-white">
                          Yes, that&apos;s right
                        </button>
                      </form>
                      <form action={disputeAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <button className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-muted)]">
                          That&apos;s wrong
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {disputed.length > 0 && (
            <section className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <h2 className="font-bold">Needs re-logging</h2>
              <p className="text-sm text-[var(--color-muted)]">
                Someone said these scores were wrong, so they never counted. Agree on the score
                and log it again.
              </p>
              <ul className="space-y-1.5 pt-1">
                {disputed.map((m) => {
                  const otherId = m.player_a === player.id ? m.player_b : m.player_a;
                  return (
                    <li key={m.id} className="nums text-sm text-[var(--color-muted)]">
                      <span className="text-[var(--color-ink)]">
                        {byId.get(otherId)?.name ?? "Someone"}
                      </span>{" "}
                      — {m.scoreline}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Link
            href="/log"
            className="flex items-center justify-between rounded-xl bg-[var(--color-clay)] px-5 py-4 font-bold text-white"
          >
            <span>Log a match</span>
            <span aria-hidden>→</span>
          </Link>

          <InviteCard
            inviteUrl={`${process.env.SITE_URL ?? "https://play-tennis.tomugun.com"}/join?c=${encodeURIComponent(group.join_code)}`}
            code={group.join_code}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Recent results
            </h2>
            <ResultsList matches={recent} players={players} />
          </section>
        </aside>
      </div>

      <p className="text-center text-sm text-[var(--color-muted)]">
        <Link href="/how" className="text-[var(--color-clay)] underline">
          How it works
        </Link>
        <span aria-hidden className="mx-2">·</span>
        <Link href="/example" className="text-[var(--color-clay)] underline">
          See an example season
        </Link>
      </p>
    </div>
  );
}

/** The signed-out home page: what this is, how to use it, then the door. */
async function Welcome() {
  const group = await getGroupBySlug(GROUP_SLUG);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <Hero groupName={group?.name} />
        <div className="mx-auto max-w-md space-y-2">
          <JoinCta label={group ? `Join ${group.name}` : "Join the league"} />
          <p className="text-center text-xs text-[var(--color-muted)]">
            You&apos;ll need the group code from whoever invited you.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">How it works</h2>
        <FlowDiagram />
        <Steps />
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-bold">Want to see it with a season in it?</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          There&apos;s a sample league with made-up players and a hundred matches.
        </p>
        <Link href="/example" className="mt-2 inline-block font-semibold text-[var(--color-clay)] underline">
          Look at the example
        </Link>
      </section>

      <PhotoStrip />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">Nothing counts until both agree</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Whoever logs the match, the other one has to confirm the score. No arguing with the
            leaderboard later.
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">It keeps your head-to-heads</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Every player page shows your record against each person in the group, so the
            argument about who usually wins has an answer.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-md">
        <JoinCta label="Ready — let me in" />
      </div>
    </div>
  );
}
