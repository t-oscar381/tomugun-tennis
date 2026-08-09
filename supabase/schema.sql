-- ---------------------------------------------------------------------------
-- tennis.tomugun.com — schema
--
-- This runs against the SAME Supabase project as celebration.tomugun.com
-- (the wedding product), so every table here is prefixed `tennis_`. Two
-- products share one `public` schema; the prefix is what keeps them from
-- ever colliding. Do not drop anything unprefixed from this file.
--
-- Source of truth: append new sections and re-run them, same convention as
-- the wedding project's supabase/schema.sql.
-- ---------------------------------------------------------------------------

-- A friend group / league. Everything is scoped to one of these.
create table if not exists public.tennis_groups (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  -- Shared secret typed once on /join. Not security — it keeps strangers out
  -- of a friend group, nothing more. Every real write goes through a route
  -- handler using the service key.
  join_code   text        not null,
  -- Match format for the league, mirroring FORMATS in src/lib/engine/tennis.ts.
  format      text        not null default 'bestOf3MatchTB',
  created_at  timestamptz not null default now()
);

-- A player. Deliberately NOT tied to auth.users: v1 identifies people by a
-- group code plus picking their own name, which is enough for a group of
-- friends. Adding real auth later means adding a nullable user_id column
-- here, not rewriting the schema.
create table if not exists public.tennis_players (
  id            uuid        primary key default gen_random_uuid(),
  group_id      uuid        not null references public.tennis_groups(id) on delete cascade,
  name          text        not null,
  emoji         text        not null default '🎾',

  -- Hidden MMR (Glicko-2). Never shown raw in the UI.
  rating        double precision not null default 1500,
  rd            double precision not null default 350,
  vol           double precision not null default 0.06,

  -- Visible ladder.
  rp            integer     not null default 0,
  peak_rp       integer     not null default 0,

  matches       integer     not null default 0,
  wins          integer     not null default 0,
  losses        integer     not null default 0,
  streak        integer     not null default 0,

  created_at    timestamptz not null default now(),
  unique (group_id, name)
);

-- A single match. `sets` holds the parsed scoreline from
-- src/lib/engine/scoreline.ts, always stored from player_a's perspective.
create table if not exists public.tennis_matches (
  id            uuid        primary key default gen_random_uuid(),
  group_id      uuid        not null references public.tennis_groups(id) on delete cascade,

  player_a      uuid        not null references public.tennis_players(id) on delete cascade,
  player_b      uuid        not null references public.tennis_players(id) on delete cascade,
  winner_id     uuid        not null references public.tennis_players(id) on delete cascade,

  sets          jsonb       not null,
  scoreline     text        not null,
  games_a       integer     not null,
  games_b       integer     not null,

  -- Pre-match win probability for player_a, from MMR. Frozen at log time so
  -- the RP maths stays reproducible even after ratings move on.
  win_prob_a    double precision not null,

  -- The trust mechanism. A match only moves the ladder once the opponent
  -- confirms, or once the confirmation window lapses.
  status        text        not null default 'pending'
                            check (status in ('pending', 'confirmed', 'disputed')),
  logged_by     uuid        not null references public.tennis_players(id) on delete cascade,
  confirmed_at  timestamptz,

  rp_delta_a    integer     not null default 0,
  rp_delta_b    integer     not null default 0,
  placement     boolean     not null default false,

  -- Glicko-2 runs in weekly rating periods, not per match. This is the
  -- Monday (UTC) of the week the match belongs to; the recalc job batches by it.
  rating_period date        not null,
  -- Set once this match has been folded into a Glicko-2 rating period.
  rated_at      timestamptz,

  played_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  constraint tennis_matches_distinct_players check (player_a <> player_b)
);

create index if not exists tennis_players_group_idx
  on public.tennis_players (group_id, rp desc);
create index if not exists tennis_matches_group_idx
  on public.tennis_matches (group_id, played_at desc);
create index if not exists tennis_matches_pending_idx
  on public.tennis_matches (group_id, status) where status = 'pending';
-- The recalc job's hot path: unrated confirmed matches, oldest period first.
create index if not exists tennis_matches_unrated_idx
  on public.tennis_matches (group_id, rating_period) where rated_at is null;

-- Rating movement, one row per player per rating period. Feeds the profile
-- chart and makes every ladder movement auditable after the fact.
create table if not exists public.tennis_rating_history (
  id             uuid        primary key default gen_random_uuid(),
  player_id      uuid        not null references public.tennis_players(id) on delete cascade,
  rating_period  date        not null,
  rating_before  double precision not null,
  rating_after   double precision not null,
  rd_before      double precision not null,
  rd_after       double precision not null,
  rp_after       integer     not null,
  played         integer     not null default 0,
  created_at     timestamptz not null default now(),
  unique (player_id, rating_period)
);

create index if not exists tennis_rating_history_player_idx
  on public.tennis_rating_history (player_id, rating_period);

-- ---------------------------------------------------------------------------
-- RLS.
--
-- Same posture as the wedding app: every read and write goes through a Next.js
-- route handler using the service-role key, which bypasses RLS. `anon` gets
-- nothing, so a leaked publishable key stays harmless. Policies are defence
-- in depth, not the access path.
--
-- join_code lives on tennis_groups, which is exactly why that table has no
-- public select policy — a readable groups table would hand out every code.
-- ---------------------------------------------------------------------------
alter table public.tennis_groups         enable row level security;
alter table public.tennis_players        enable row level security;
alter table public.tennis_matches        enable row level security;
alter table public.tennis_rating_history enable row level security;

-- ---------------------------------------------------------------------------
-- Grants. Newer Supabase projects don't give service_role blanket privileges
-- on tables you create yourself — without these every write comes back as
-- "42501 permission denied for table … TO service_role".
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant all privileges on table
  public.tennis_groups,
  public.tennis_players,
  public.tennis_matches,
  public.tennis_rating_history
  to service_role;

grant all privileges on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Seed: one group to play with. Change the join code before sharing it.
-- ---------------------------------------------------------------------------
insert into public.tennis_groups (slug, name, join_code)
values ('jakarta', 'Jakarta Social Tennis', 'DEUCE')
on conflict (slug) do nothing;
