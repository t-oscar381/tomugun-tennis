import { getGroupBySlug, getPlayers } from "@/lib/db";
import { GROUP_SLUG } from "@/lib/league";
import { safeNext } from "@/lib/next";
import { SHOTS } from "@/lib/photos";
import { codeMatches } from "@/lib/session";
import { Photo } from "@/components/photo";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/**
 * Joining, in two steps.
 *
 * Step one is the code; step two is who you are. They used to be one screen,
 * which meant the roster of every player was rendered to anyone who opened the
 * page — so the code protected nothing — and the code itself was sitting in
 * the input's placeholder attribute, in plain sight.
 *
 * The code travels in the query string so a single link can carry it: paste
 * play-tennis.tomugun.com/join?c=CODE into the group chat and everyone lands
 * on step two. That is the same secret it always was, shared the same way —
 * anyone with the link is in, which is the deal for a friend group.
 *
 * This page belongs to one group: it shows that group's name, and only that
 * group's roster, and only after the code. `next` carries the page someone was
 * trying to open, so a shared /play link ends up at /play.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; next?: string }>;
}) {
  const { c, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const group = await getGroupBySlug(GROUP_SLUG);

  if (!group) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl">No league yet</h1>
        <p className="text-sm text-muted">
          Run <code className="text-ink">supabase/schema.sql</code> against the Supabase project,
          then reload. It seeds a group with the slug <code className="text-ink">{GROUP_SLUG}</code>.
        </p>
      </div>
    );
  }

  const attempted = typeof c === "string" && c.length > 0;
  const unlocked = attempted && codeMatches(c, group.join_code);

  // The roster is only ever sent to someone who already has the code.
  const players = unlocked
    ? (await getPlayers(group.id)).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))
    : [];

  return (
    <div className="card mx-auto grid max-w-5xl overflow-hidden lg:grid-cols-[1fr_1.05fr]">
      {/* The photo: a strip on a phone, half the card on a laptop. */}
      <div className="relative isolate min-h-44 bg-court-deep text-white lg:min-h-[36rem]">
        <Photo shot={SHOTS.benches} w={720} eager className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-court-deep/95 via-court-deep/45 to-court-deep/10" />
        <div className="flex h-full flex-col justify-end p-6 sm:p-9">
          <p className="eyebrow text-lime">{unlocked ? "Step 2 of 2" : "Step 1 of 2"}</p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{group.name}</h1>
          <p className="mt-2 hidden max-w-xs text-sm text-white/80 lg:block">
            There&apos;s a seat on the bench. Add your name and the points you win go under it.
          </p>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-9">
        <div>
          <h2 className="text-2xl">{unlocked ? "You're in. Who are you?" : "Got the group code?"}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {unlocked
              ? "Add yourself so the points you win go under your name."
              : "It's in the invite link — or ask whoever invited you."}
          </p>
        </div>

        <JoinForm
          players={players}
          unlocked={unlocked}
          wrongCode={attempted && !unlocked}
          code={unlocked ? c : ""}
          next={next}
        />
      </div>
    </div>
  );
}
