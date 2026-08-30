# tomugun-tennis

`play-tennis.tomugun.com` — log a friendly match, climb a ranked ladder.
Official ITF tennis scoring for the points, Apex-style tiers for the competition.

One repo, one Cloudflare Worker, one subdomain — the same rule as
`tomugun-celebration`.

## Getting it running

```bash
npm install
```

**1. Apply the schema.** Open the Supabase SQL editor for the project and paste
`supabase/schema.sql`. Every table is prefixed `tennis_` because this project
*shares a Supabase project with the wedding app* — the prefix is the only thing
keeping the two products out of each other's way. The file is the source of
truth: append new sections and re-run them, same convention as the wedding app.

It seeds one group, slug `jakarta`, join code `DEUCE`. **Change that code before
sharing the link.**

**2. Environment.** `.env.local` is already populated from the wedding project.
For a fresh checkout, copy `.env.example` and fill in the service-role key.

```bash
npm run dev          # http://localhost:3220
```

Port 3220 — 3000 is dg-clinic and 3210 is the wedding app.

**3. Optional: seed a demo league.**

```bash
npm run seed -- --wipe
```

Eight players, fourteen weeks of simulated matches. This is worth running once
even if you don't want the demo data, because it does not write ratings
directly — it inserts matches as `pending` and then calls the *same*
`confirmMatch` and `runRatingPeriods` the app uses. A clean run is an
end-to-end proof that scoreline parsing, RP entry costs, repeat decay,
placement seeding and weekly Glicko-2 all work against the live database.

## How the ranking works

Two numbers per player, deliberately separate:

- **MMR** (Glicko-2) — hidden. Drives matchmaking odds and the upset bonus.
  Carries a rating deviation, so new players move fast and settled ones slowly.
- **RP** — the visible ladder. Gated by an entry cost you forfeit just to step
  on court.

They run on **different clocks**, and this is the one piece of the design most
worth understanding:

| | when it updates | why |
|---|---|---|
| RP | the instant a match is confirmed | immediate feedback is the entire point of a visible ladder |
| MMR | batched into weekly rating periods | Glicko-2 is *defined* over a period of several results; updating per match makes its volatility term meaningless and overreacts to one upset |

So a freshly confirmed match moves your RP now and your MMR next Monday. The
ladder page folds any closed weeks in on load, so it's never stale even with no
cron running.

**Entry cost is the only tuning lever.** Every tier's difficulty is derived
from one declared curve — the win rate each tier should demand just to hold
station (`TARGET_HOLD_WIN_RATE` in `src/lib/engine/ranks.ts`). Change that and
the whole economy re-solves.

**Nothing counts until the opponent confirms it — for 48 hours.** An unverified
ledger is worse than no ladder, but so is a ladder frozen by one person who
never opens the app. After the window lapses, silence counts as agreement
(`autoConfirmStale`, run on ladder load, so no cron is needed). Disputes send
the match back for re-logging and surface on both players' home screens until
someone does; there is deliberately no arbitration UI.

The tuning behind all of this was simulated first, over 120+ seasons — see the
`rally-rank` project for the measured results and the known trade-off about the
top two tiers.

## Ways to play

The ladder is one format of several — see `/formats`.

| Format | Sides | Ranked? |
|---|---|---|
| Knockout tournament | singles or pairs | no — its own event |
| Running ladder | singles | yes |
| Rotation night — singles | singles | yes (they're ordinary 1-v-1 matches) |
| Rotation night — doubles | doubles | **no** — social only |
| Doubles ladder (fixed partner) | doubles | not built |

`src/lib/engine/bracket.ts` runs knockout draws. Seeding is built by
reflection — a bracket of 2n is the bracket of n with each slot followed by its
mirror — which is what guarantees seeds 1 and 2 can only meet in the final.
Fields are padded to the *smallest* power of two at or above the entry count,
so **byes can only ever occur in round 0**: every first-round match always holds
at least the higher seed. An earlier version tried to advance anyone left alone
in a later round and confused "no result entered yet" with "no opponent
possible", crowning a champion after three matches of fifteen.

`src/lib/engine/rotation.ts` draws the fixtures for a rotation night. It is not
a shuffle: a naive random draw pairs the same two people three times in five
rounds and benches one person twice while another never rests. It optimises,
in priority order, for no repeat partners, level court time, shared byes, and
only then repeat opponents — a repeat opponent is fine, a repeat *partner*
defeats the point of the format. Seeded, so "shuffle" is reproducible.

**Doubles results are deliberately not ranked.** The ladder rates individuals
with Glicko-2; splitting credit between two halves of a winning pair needs a
team model (TrueSkill). Rating them anyway would put invented numbers beside
real ones, so doubles nights schedule but don't score.

## Identity

There is no authentication in v1, and it doesn't pretend otherwise: a group
join code, then you pick which player you are, stored in a cookie. Anyone with
the code can claim to be anyone. That's an acceptable trade for a friend group,
and it's exactly why the confirmation step carries the weight.

Joining is two steps: the code, then who you are. They were one screen until
the roster of every player was being rendered to anyone who opened `/join` —
so the code gated nothing — and the code itself was sitting in the input's
`placeholder` attribute in plain sight. The roster is now only sent to someone
who already has the code.

The code travels in the query string, so **one link carries it**:
`/join?c=CODE`. That is what you paste into the group chat; signed-in players
get a copy/WhatsApp card for it on the ladder. Anyone with the link is in,
which is exactly what a shared group code has always meant here.

Because "pick your name" makes it easy to end up as the wrong person — shared
phone, borrowed tablet, mis-tap — the header carries an account menu showing
who you are, your rank, and a sign-out. Signing out lands on `/`, not `/join`,
so the next person sees what the app is before being asked for a code.

Upgrading is cheap by design — add a nullable `user_id` to `tennis_players` and
check it in `src/lib/session.ts`. No schema rewrite, no data migration.

## Layout

| Path | What |
|---|---|
| `src/lib/engine/tennis.ts` | ITF scoring state machine. Feed it point winners, get `6-4 3-6 [10-8]`. Shared with the future live scorekeeper. |
| `src/lib/engine/scoreline.ts` | Parses and validates hand-typed scores. The gatekeeper for data quality. |
| `src/lib/engine/glicko2.ts` | Glicko-2, full spec including volatility. |
| `src/lib/engine/ranks.ts` | Tiers, divisions, entry costs, placements. |
| `src/lib/rating.ts` | Where a confirmed match becomes ladder movement. |
| `src/app/actions.ts` | Server actions. Only async exports allowed here — constants live in `src/lib/league.ts`. |
| `src/app/log/score-picker.tsx` | Tap-only score entry: number chips, derived winner, live scoreboard preview. |
| `src/app/globals.css` | Light theme. Four brand values at the top re-skin the whole app. |
| `src/components/rp-chart.tsx` | RP curve, rebuilt from the match ledger — see the note there on why `rating_history.rp_after` cannot be used. |
| `src/lib/engine/rotation.ts` | Rotation-night fixture draw. Optimises partner variety and court time, not just randomness. |
| `src/lib/engine/formats.ts` | The catalogue of play formats, with an honest `status` per entry. |
| `src/lib/engine/bracket.ts` | Knockout draws: seeding, byes, advancement, undo. |

`npm test` covers the scoring engine, the score validator, the dispute window
the rotation scheduler's fairness guarantees and the knockout bracket
(62 tests). `npm run selftest` drives the real write path against the
live database in a throwaway group.

## Deploying

```bash
npm run cf:deploy
```

Set `SUPABASE_SERVICE_ROLE_KEY` as a **Secret** in the Cloudflare dashboard, not
a Variable — `wrangler deploy` wipes plain variables not declared in
`wrangler.jsonc` on every deploy, but never touches secrets.

Then add `play-tennis.tomugun.com` as a custom domain on the Worker. DNS
auto-creates because the zone already lives on Cloudflare.

No `runtime = "edge"` anywhere — it breaks page loading under OpenNext, the
same way it did in `tomugun-celebration`. Routes use `dynamic = "force-dynamic"`
instead.

## Known wrinkle

`tennis_rating_history.rp_after` records RP at the moment the weekly Glicko job
runs, not when RP actually moved (RP moves on confirmation). Under a real
weekly cadence it is roughly right; after a backfill every row holds the same
present-day value. Nothing reads it — the RP chart walks `rp_delta` instead —
but don't trust that column for analytics without fixing it first.

## Not built yet

The live point-by-point scorekeeper (the engine is ready and tested, the UI
isn't), doubles (needs TrueSkill-style team ratings, not Glicko), season resets,
per-player emoji/avatar choice, and scoring for doubles rotation nights (which
needs the team rating model above).
