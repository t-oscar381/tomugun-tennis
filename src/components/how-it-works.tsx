import Link from "next/link";
import { ENTRY_COST, RP, TIERS } from "@/lib/engine/ranks";
import { GALLERY, HERO, STEP_SHOTS, photo } from "@/lib/photos";
import { tierColor } from "./rank";

/**
 * The explainer. Shown on the home page to anyone not signed in, and at /how
 * for everyone else.
 *
 * Written for someone who has never used the app and does not care how it
 * works internally — no mention of Glicko, MMR, entry-cost formulas or
 * rating periods. The one mechanic worth surfacing is that a result doesn't
 * count until the opponent agrees, because that changes what people *do*.
 */

const STEPS = [
  {
    n: 1,
    title: "Join the group",
    body: "Type the group code someone shared with you, then pick your name from the list. No password, no email.",
  },
  {
    n: 2,
    title: "Play your match",
    body: "Normal tennis, normal scoring. Play a set or three — however you usually play.",
  },
  {
    n: 3,
    title: "Log the score",
    body: "Tap Log a match, pick who you played, then tap + and − to build the score. No typing, so you can\u2019t fat-finger a 6-5.",
  },
  {
    n: 4,
    title: "They confirm it",
    body: "Your opponent gets it on their home screen and taps to agree. Nothing counts until they do — that's what keeps the ladder honest.",
  },
  {
    n: 5,
    title: "Your rank moves",
    body: "Win and you climb. Lose and you slide. Beat someone above you and you jump further. No maths to do \u2014 it just moves.",
  },
];

/** Wide-screen at-a-glance version. Hidden on phones, where the cards do the job. */
export function FlowDiagram() {
  const nodes = [
    { x: 8, l1: "Join the", l2: "group" },
    { x: 198, l1: "Play, then", l2: "log the score" },
    { x: 388, l1: "Opponent", l2: "confirms it" },
    { x: 578, l1: "Your rank", l2: "moves" },
  ];

  return (
    <svg
      viewBox="0 0 760 132"
      role="img"
      aria-label="Flow: join the group, play and log the score, your opponent confirms it, your rank moves."
      className="hidden h-auto w-full sm:block"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-clay)" />
        </marker>
      </defs>

      {nodes.map((n, i) => (
        <g key={n.x}>
          <rect
            x={n.x}
            y={26}
            width={165}
            height={92}
            rx={14}
            fill="var(--color-surface)"
            stroke="var(--color-line)"
          />
          <circle cx={n.x + 82.5} cy={54} r={15} fill="var(--color-clay)" />
          <text
            x={n.x + 82.5}
            y={59}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill="var(--color-bg)"
          >
            {i + 1}
          </text>
          <text x={n.x + 82.5} y={87} textAnchor="middle" fontSize={13} fill="var(--color-ink)">
            {n.l1}
          </text>
          <text x={n.x + 82.5} y={104} textAnchor="middle" fontSize={13} fill="var(--color-ink)">
            {n.l2}
          </text>
          {i < nodes.length - 1 && (
            <line
              x1={n.x + 170}
              y1={72}
              x2={n.x + 190}
              y2={72}
              stroke="var(--color-clay)"
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export function Steps() {
  return (
    <ol className="space-y-3">
      {STEPS.map((s) => (
        <li
          key={s.n}
          className="flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <img
            src={photo(STEP_SHOTS[s.n - 1]!.id, 200)}
            alt={STEP_SHOTS[s.n - 1]!.alt}
            loading="lazy"
            className="h-24 w-20 shrink-0 object-cover sm:w-28"
          />
          <span className="flex min-w-0 flex-1 gap-3 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-clay)] text-sm font-bold text-[var(--color-bg)]">
              {s.n}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{s.title}</span>
              <span className="mt-0.5 block text-sm text-[var(--color-muted)]">{s.body}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The ranks, with the honest bit spelled out: higher tiers charge more to
 * play, so standing still costs you. That single sentence explains why the
 * ladder feels tense without anyone needing the maths.
 */
export function RankExplainer() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TIERS.map((tier, i) => (
          <span
            key={tier}
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{
              color: tierColor(tier),
              background: `color-mix(in oklab, ${tierColor(tier)} 16%, transparent)`,
            }}
          >
            {tier}
            <span className="nums ml-1.5 opacity-70">−{ENTRY_COST[i]}</span>
          </span>
        ))}
      </div>
      <p className="text-sm text-[var(--color-muted)]">
        Every match charges you rank points just to play — the number next to each tier above.
        Bronze barely notices it. Near the top it costs so much that only winning most of your
        matches keeps you there. Your first{" "}
        <span className="text-[var(--color-ink)]">{RP.placementMatches} matches are free</span>{" "}
        while the app works out how good you are.
      </p>
    </div>
  );
}

export function JoinCta({ label = "Join the league" }: { label?: string }) {
  return (
    <Link
      href="/join"
      className="block w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 text-center font-bold text-[var(--color-bg)] transition-colors hover:bg-[var(--color-sand)]"
    >
      {label}
    </Link>
  );
}


/** Full-bleed opening image with the promise written over it. */
export function Hero({ groupName }: { groupName?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <img
        src={photo(HERO.id, 1200, 75)}
        alt={HERO.alt}
        className="h-[62vh] max-h-[520px] w-full object-cover"
      />
      {/* Two stops rather than one: the text sits on solid colour, while the
          top of the photo stays bright enough to still read as a photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          All your tennis,
          <br />
          <span className="text-[var(--color-clay)]">one ladder.</span>
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--color-ink)]/85">
          {groupName ? `${groupName} — ` : ""}play your normal friendly matches, log the score in
          ten seconds, and watch your rank actually move.
        </p>
      </div>
    </div>
  );
}

/** Photo strip. Placeholders until the group has its own match photos. */
export function PhotoStrip() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {GALLERY.map((shot) => (
          <img
            key={shot.id}
            src={photo(shot.id, 400)}
            alt={shot.alt}
            loading="lazy"
            className="aspect-square w-full rounded-xl object-cover"
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
        Placeholder photography via{" "}
        <a href="https://unsplash.com" target="_blank" rel="noopener" className="underline">
          Unsplash
        </a>{" "}
        — swap in your own court shots.
      </p>
    </div>
  );
}
