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

**Nothing counts until the opponent confirms it.** An unverified ledger is
worse than no ladder. Disputes are a dead end on purpose — the two players sort
it out and re-log, rather than the app growing an arbitration UI a group of
friends doesn't need.

The tuning behind all of this was simulated first, over 120+ seasons — see the
`rally-rank` project for the measured results and the known trade-off about the
top two tiers.

## Identity

There is no authentication in v1, and it doesn't pretend otherwise: a group
join code, then you pick which player you are, stored in a cookie. Anyone with
the code can claim to be anyone. That's an acceptable trade for a friend group,
and it's exactly why the confirmation step carries the weight.

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

`npm test` covers the scoring engine and the score validator (31 tests).

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

## Not built yet

The live point-by-point scorekeeper (the engine is ready and tested, the UI
isn't), doubles (needs TrueSkill-style team ratings, not Glicko), season resets,
and the WhatsApp share card.
