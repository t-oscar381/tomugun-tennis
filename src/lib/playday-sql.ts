/**
 * The one statement a play day needs. Shown in the app until it has been run,
 * and checked against supabase/schema.sql by a test so the two cannot drift.
 */
export const PLAYDAY_SQL = `-- Play days: who turned up on which date. Matches are filed under a play day
-- by their played_at date (Jakarta time), so tennis_matches needs no new column.
create table if not exists public.tennis_sessions (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.tennis_groups(id) on delete cascade,
  played_on   date        not null,
  -- Player ids present that day. Five or six of an eight-person pool is normal.
  attendees   jsonb       not null default '[]'::jsonb,
  created_by  uuid        references public.tennis_players(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, played_on)
);

alter table public.tennis_sessions enable row level security;
grant all privileges on table public.tennis_sessions to service_role;`;

/** Where to paste it. The project ref is already public in wrangler.jsonc. */
export const SQL_EDITOR_URL = "https://supabase.com/dashboard/project/kufmpppkpmjcmsyeztdm/sql/new";
