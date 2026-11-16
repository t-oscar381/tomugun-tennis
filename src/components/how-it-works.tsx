import Link from "next/link";
import { SHOTS, type Shot } from "@/lib/photos";
import { Photo } from "./photo";

/**
 * The explainer pieces. Shown on the home page to anyone not signed in, and at
 * /how for everyone else.
 *
 * Written for someone who has never used the app: no scoring jargon, because
 * there is no scoring. You play, you tap who won.
 */

const STEPS: { title: string; body: string; shot: Shot }[] = [
  {
    title: "Join with one link",
    body: "Open the link from the group chat and add your name. No password, no email, nothing to install.",
    shot: SHOTS.benches,
  },
  {
    title: "Play your usual game",
    body: "Two against two, or one against one. Keep score on court the way you always do — it stays on court.",
    shot: SHOTS.volley,
  },
  {
    title: "Tap who won",
    body: "Tap the people on each team, then the team that won. Everyone on it gets a point. That is the whole thing.",
    shot: SHOTS.ready,
  },
];

/** Three tall photo cards. The number sits on the photo, the words underneath. */
export function Steps() {
  return (
    <ol className="grid gap-5 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="card zoom overflow-hidden">
          <div className="relative overflow-hidden">
            <Photo shot={s.shot} w={520} className="aspect-[4/3] w-full object-cover sm:aspect-[4/5]" />
            <div className="absolute inset-0 bg-gradient-to-t from-court-deep/70 via-transparent to-transparent" />
            <span className="display nums absolute bottom-3 left-4 text-5xl italic text-white/95">
              0{i + 1}
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-xl">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const POINTS = [
  {
    title: "Anyone can log it",
    body: "One court, the rest of you watching. Whoever has a phone out taps who won — it doesn't have to be someone in the game.",
  },
  {
    title: "It remembers who you win with",
    body: "Every player page shows your record with each partner and against each opponent, so the argument about pairings has an answer.",
  },
  {
    title: "Wrong tap? Take it back",
    body: "Remove a game in two taps and log it again. Points are worked out from the games, so they correct themselves.",
  },
  {
    title: "The day, in the group chat",
    body: "One button sends the day's games and points to WhatsApp, where the group already lives.",
  },
];

/** Photo on one side, the four things worth knowing on the other. */
export function Features() {
  return (
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="relative">
        <div className="zoom overflow-hidden rounded-3xl shadow-[0_30px_60px_-30px_rgb(6_42_32/0.6)]">
          <Photo shot={SHOTS.palms} w={720} className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
        </div>
        {/* A second, smaller frame overlapping the first — the layered look of a printed programme. */}
        <div className="absolute -bottom-6 -right-2 hidden w-2/5 overflow-hidden rounded-2xl border-4 border-bg shadow-xl sm:block lg:-right-8">
          <Photo shot={SHOTS.net} w={320} className="aspect-square w-full object-cover" />
        </div>
      </div>

      <div>
        <p className="eyebrow text-clay">Made for one court and a group chat</p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
          Less admin, <em className="text-clay">more tennis.</em>
        </h2>
        <dl className="mt-7 space-y-6">
          {POINTS.map((p, i) => (
            <div key={p.title} className="flex gap-4">
              <dt className="sr-only">{p.title}</dt>
              <span className="display nums mt-0.5 w-7 shrink-0 text-lg italic text-clay">0{i + 1}</span>
              <dd>
                <p className="font-bold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** A small editorial grid of court photographs. */
export function Gallery() {
  const cell = "zoom overflow-hidden rounded-2xl";
  const img = "size-full object-cover";
  return (
    <section>
      <div className="grid auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] sm:grid-cols-4">
        <div className={`${cell} col-span-2 row-span-2`}>
          <Photo shot={SHOTS.backhand} w={720} className={img} />
        </div>
        <div className={cell}>
          <Photo shot={SHOTS.lines} w={360} className={img} />
        </div>
        <div className={cell}>
          <Photo shot={SHOTS.kit} w={360} className={img} />
        </div>
        <div className={`${cell} col-span-2`}>
          <Photo shot={SHOTS.dusk} w={720} className={img} />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Photography from{" "}
        <a href="https://unsplash.com" target="_blank" rel="noopener" className="underline">
          Unsplash
        </a>{" "}
        for now — your own court shots belong here.
      </p>
    </section>
  );
}

export function JoinCta({ label = "Join the group" }: { label?: string }) {
  return (
    <Link href="/join" className="btn btn-clay w-full">
      {label}
      <span aria-hidden>→</span>
    </Link>
  );
}

/** The closing band: dark green, a court behind it, one button. */
export function ClosingCta({
  title,
  body,
  href,
  label,
}: {
  title: React.ReactNode;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-court-deep px-6 py-14 text-center text-white sm:px-12 sm:py-20">
      <Photo shot={SHOTS.green} w={1100} className="absolute inset-0 -z-20 size-full object-cover opacity-35" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-court-deep/60 to-court-deep/95" />
      <h2 className="mx-auto max-w-xl text-3xl leading-tight sm:text-5xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-md text-white/80">{body}</p>
      <Link href={href} className="btn btn-clay mt-8">
        {label}
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
